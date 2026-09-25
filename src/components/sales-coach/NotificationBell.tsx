"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Trophy, CircleDollarSign } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * NotificationBell — in-app alerts for whoever the caller is the recipient of.
 *
 * NO LONGER MANAGER-ONLY (2026-09-21). It began as the manager's bell (gamification Phase 4) and
 * still carries strong-session and deal-closed alerts to managers. It now also carries
 * `pitch_score_corrected` to the REP whose score a manager changed — the same table, the same
 * recipient-scoped RLS, no second bell. The table is still named `manager_notifications`, which is
 * now narrower than its contents; 0257 says why renaming it was not worth the blast radius. Opens a dropdown with strong-session /
 * deal-closed alerts, each linking to the session; mark-all-read. Alerts arrive LIVE via Supabase Realtime (founder
 * 2026-09-04): the bell subscribes to new manager_notifications INSERTs for the caller and re-fetches instantly.
 * RLS (0242: recipient_id = auth.uid()) is enforced per-subscriber, so a manager only ever receives their OWN
 * alerts. A 60s poll stays as the fallback for a dropped socket.
 */

type Notif = {
  id: string;
  agent_id: string;
  session_id: string | null;
  /**
   * Every type `manager_notifications` accepts, which is the point of listing them here.
   *
   * THREE OF THESE WERE WRITTEN BEFORE THIS BELL KNEW THEM, all on 2026-09-22 — the two
   * recording types (0261) and the pattern type (0262). Each had a migration, a CHECK entry, a
   * writer and a reason, and each would have arrived here and fallen through `text()` to the
   * deal-closed branch, rendering "A rep closed a deal" for a coaching note. The row was
   * written, the bell rang, and the sentence was wrong.
   *
   * Same family as the `pattern_events` defect this build just gated: a value written that no
   * surface renders. `writer:audit` catches it at the TABLE level and cannot see this one,
   * because the table has plenty of writers — it is a new VALUE in a closed set. The cheap
   * defence is the exhaustive switch below, which a new type cannot pass without a branch.
   */
  // enum-source: manager_notifications.type
  type:
    | "strong_session"
    | "deal_closed"
    | "pitch_score_corrected"
    | "recording_comment"
    | "recording_share_requested"
    | "pattern_coached"
    | "pattern_clip_disputed";
  pattern_id?: string | null;
  payload: {
    agent_name?: string | null;
    total?: number;
    band?: string;
    deal_value?: number | null;
    /** pitch_score_corrected: what a manager changed, and what the score became. */
    item_label?: string;
    qualifying?: boolean;
    /** recording_comment / recording_share_requested: which pitch, and where in it. */
    pitch_id?: string;
    timestamp_s?: number;
    excerpt?: string;
    note?: string;
    /** pattern_coached: which pattern, and which of the three manager actions it was. */
    pattern_label?: string;
    action?: "coached" | "drill_assigned" | "note";
  };
  created_at: string;
  read_at: string | null;
};

function rel(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function text(n: Notif): string {
  // Addressed to the REP, in the second person, because they are the subject as well as the
  // recipient. Every other alert here is a manager reading about somebody else.
  if (n.type === "pitch_score_corrected") {
    const what = n.payload.item_label ? ` to ${n.payload.item_label}` : "";
    const total = n.payload.total != null ? ` — your score is now ${n.payload.total}` : "";
    // Said plainly, because an override can cross the 40-base line in either direction and a rep
    // whose pitch stopped counting must not learn it from a leaderboard they have fallen off.
    const counts = n.payload.qualifying === false ? ", and it no longer counts" : "";
    return `A manager made a correction${what}${total}${counts}`;
  }
  // Addressed to the rep, all three. A manager left a comment on a recording of them, asked to
  // play one to the team, or coached a pattern of theirs.
  if (n.type === "recording_comment") {
    const at = n.payload.timestamp_s != null ? ` at ${mmss(n.payload.timestamp_s)}` : "";
    return `Your manager left a comment on one of your pitches${at}`;
  }
  if (n.type === "recording_share_requested") {
    return "Your manager asked to play one of your pitches to the team";
  }
  if (n.type === "pattern_coached") {
    const what = n.payload.pattern_label ? ` on “${n.payload.pattern_label}”` : "";
    // The action decides the verb, which is why one notification type carries three of them.
    if (n.payload.action === "drill_assigned") return `Your manager assigned you a drill${what}`;
    if (n.payload.action === "coached") return `Your manager coached you${what}`;
    return `Your manager left you a note${what}`;
  }

  const who = n.payload.agent_name || "A rep";
  // THE ONE THAT POINTS BACK. Every other rep-related alert here is addressed to the rep; this
  // one is a manager being told a rep disagrees with the scorer about a specific moment.
  if (n.type === "pattern_clip_disputed") {
    const what = n.payload.pattern_label ? ` on “${n.payload.pattern_label}”` : "";
    return `${who} says a clip looks wrong${what}`;
  }
  if (n.type === "strong_session") return `${who} ran a strong session — ${n.payload.total ?? ""} points`;
  if (n.type === "deal_closed") {
    const v = n.payload.deal_value;
    return `${who} closed a deal${v ? ` ($${Number(v).toLocaleString()})` : ""}`;
  }
  // EXHAUSTIVE. A new type added to the CHECK constraint and not to this file is a compile
  // error here rather than a wrong sentence in a rep's bell — which is what the three types
  // above would have been if this had stayed an unguarded fall-through.
  return assertNever(n.type);
}

/** Seconds into a recording, as the player prints them. */
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function assertNever(t: never): string {
  // Unreachable while the union matches the CHECK. If it ever runs, a row exists that this file
  // has no words for, and saying so is better than inventing them.
  console.error(`[NotificationBell] unhandled notification type: ${String(t)}`);
  return "You have a new notification";
}

/**
 * Types addressed to the REP about themselves, which get the dot rather than a glyph.
 *
 * THE DOT IS A LAW-1 DECISION, not a style one, and it is inherited rather than re-argued: the
 * `pitch_score_corrected` branch chose it because placing an icon without having opened and
 * looked at it is what that rule forbids, and no render of a candidate glyph was available. The
 * same is true of the three types added on 2026-09-22, so they join the same branch instead of
 * each acquiring a mark nobody has seen.
 */
const REP_ADDRESSED: ReadonlySet<Notif["type"]> = new Set([
  "pitch_score_corrected",
  "recording_comment",
  "recording_share_requested",
  "pattern_coached",
]);

/**
 * Where an alert takes you, or null when it takes you nowhere.
 *
 * A BELL THAT LINKS TO THE WRONG PLACE IS WORSE THAN ONE THAT LINKS NOWHERE, so each type names
 * its own destination rather than sharing a session-shaped default. `pattern_coached` has no
 * session at all — a pattern spans many — and before this it would have rendered as an
 * unclickable row, which is the quiet half of the same defect.
 */
function destination(n: Notif): string | null {
  // Both pattern types land on the same board; the manager reads the dispute where the pattern is.
  if (n.type === "pattern_coached" || n.type === "pattern_clip_disputed") {
    return "/dashboard/sales-coach/pattern-interrupt";
  }
  if (n.type === "recording_comment" || n.type === "recording_share_requested") {
    // The rep's own pitch detail, where a sent comment renders and a share request can be
    // answered. Both were built on 2026-09-22 and both key on the pitch, not the session.
    return n.payload.pitch_id
      ? `/dashboard/sales-coach/doors/report-card/${n.payload.pitch_id}`
      : null;
  }
  if (!n.session_id) return null;
  // The session page, NOT /after-pitch and NOT the door-log report card. PitchScorePanel — and
  // the corrections section the rep is being sent to read — renders on
  // /dashboard/sales-coach/[id], where [id] is the session id. The door-log report card takes a
  // pitchId and belongs to a different feature that happens to share the word "pitch".
  return n.type === "pitch_score_corrected"
    ? `/dashboard/sales-coach/${n.session_id}`
    : `/dashboard/sales-coach/${n.session_id}/after-pitch`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  /** How many exist in total, so a bounded list can say so. Null = no count available. */
  const [total, setTotal] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/gamification/notifications");
      if (!res.ok) return;
      const d = (await res.json()) as {
        notifications: Notif[];
        // `null` when the count could not be read — show no badge rather than a number the
        // server could not stand behind. Undefined is the same case from an older route.
        unread: number | null;
        total?: number | null;
      };
      setItems(d.notifications);
      setUnread(d.unread ?? 0);
      setTotal(d.total ?? null);
    } catch {
      /* offline / transient — leave the last state */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000); // fallback poll (backstop for a dropped realtime socket)
    return () => clearInterval(t);
  }, [load]);

  // Realtime (founder 2026-09-04): push new alerts instantly. Subscribe to this manager's own notification INSERTs
  // and re-fetch on each — a re-fetch (not a payload prepend) keeps the shape + unread count consistent with the
  // poll and avoids coupling to the realtime row shape. A dropped socket is fine: the poll above is the fallback.
  useEffect(() => {
    if (!supabaseEnabled) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const uid = data.user?.id;
        if (cancelled || !uid) return;
        channel = supabase
          .channel(`manager-notifs:${uid}`)
          .on(
            "postgres_changes",
            // "*" and not "INSERT", and the difference is a whole class of alert.
            //
            // Every notification in this table used to be an insert, so INSERT was complete. The
            // correction notice (0257) is an UPSERT: a SECOND correction to the same pitch updates
            // the existing row, refreshing its timestamp and clearing read_at. Under an
            // INSERT-only subscription that second correction would never arrive live — it would
            // surface on the 60s poll, so the first correction is instant and every one after it
            // is late, which is the confusing way round.
            //
            // The cost of "*" is that mark-all-read now echoes back one extra re-fetch, since it
            // updates read_at on rows this subscriber owns. One fetch, no loop — the re-fetch
            // writes nothing — and it keeps the unread badge honest if two tabs are open.
            { event: "*", schema: "public", table: "manager_notifications", filter: `recipient_id=eq.${uid}` },
            () => void load(),
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              // eslint-disable-next-line no-console
              console.warn(`[notifications] realtime ${status} — falling back to the poll`);
            }
          });
      })
      .catch(() => {
        /* realtime unavailable → the poll covers it */
      });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const post = useCallback(async (body: { all: true } | { ids: string[] }) => {
    try {
      await fetch("/api/coach/gamification/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* best-effort; the next poll reconciles */
    }
  }, []);

  /**
   * "Mark all read" — the button in the panel header. Unbounded on purpose: a person pressing a
   * button labelled *all* has said what they mean.
   */
  const markAllRead = useCallback(async () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await post({ all: true });
  }, [post]);

  /**
   * MARK WHAT WAS SHOWN — the automatic one, when the panel opens.
   *
   * This used to post `{ all: true }`, and that was a real defect rather than a rough edge. The
   * list is capped at fifty; the write was not. So opening the bell marked read every unread
   * notification the recipient had, INCLUDING the ones older than the page, which the panel had
   * never displayed and had no way to display. They were consumed by a gesture that means "let me
   * look", and afterwards were indistinguishable from ones that had been read and dismissed.
   *
   * What lands here is not decoration: a clip a rep disputed, a comment on a recording, a score
   * correction. A11 — the mirror a rep cannot dispute is a judge — is the clause that makes a
   * silently-consumed dispute the wrong kind of quiet.
   *
   * "Read" now means "was shown". The badge drops by exactly what the panel displayed, so a
   * recipient with more than a page still sees a number afterwards, and the rest keep waiting.
   */
  const markShownRead = useCallback(async () => {
    const ids = items.filter((n) => n.read_at === null).map((n) => n.id);
    // `{ ids: [] }` is a 400 — the body schema requires at least one — and there is nothing to
    // say anyway.
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setUnread((u) => Math.max(0, u - ids.length));
    setItems((prev) => prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n)));
    await post({ ids });
  }, [items, post]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) void markShownRead();
        }}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg p-2 text-secondary hover:bg-surface-raised hover:text-primary"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-default bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-default px-3 py-2">
            <span className="text-sm font-semibold text-primary">Notifications</span>
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-muted hover:text-primary">
                Mark all read
              </button>
            )}
          </div>
          {typeof total === "number" && total > items.length && (
            // A bounded list that cannot say it is bounded is a list claiming to be the whole
            // set. Shown as a header line rather than a footer because the panel scrolls and a
            // footer would sit below fifty rows nobody scrolls past.
            <p className="border-b border-default px-3 py-1.5 text-[11px] text-muted">
              Showing the {items.length} most recent of {total}.
            </p>
          )}
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted">No notifications yet.</div>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={`flex items-start gap-2.5 px-3 py-2.5 ${n.read_at === null ? "bg-primary/5" : ""}`}>
                  {/*
                    A DOT for the correction, not a glyph. Every icon in this file is a graphic
                    asset, and placing a new one without having opened and looked at it is exactly
                    what LAW 1 forbids — a mark that renders invisibly against its own ground is
                    the failure that rule exists for, and no render of a candidate glyph was
                    available here. A token-coloured dot is styling, carries the same severity
                    signal, and is inspectable in the two theme blocks it uses.
                  */}
                  {REP_ADDRESSED.has(n.type) ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  ) : (
                    <span className={`mt-0.5 ${n.type === "deal_closed" ? "text-emerald-500" : "text-amber-500"}`}>
                      {n.type === "deal_closed" ? <CircleDollarSign size={16} /> : <Trophy size={16} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-primary">{text(n)}</p>
                    <p className="mt-0.5 text-xs text-muted">{rel(n.created_at)}</p>
                  </div>
                </div>
              );
              const href = destination(n);
              return href ? (
                <Link key={n.id} href={href} onClick={() => setOpen(false)} className="block border-b border-default last:border-b-0 hover:bg-surface-raised">
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-default last:border-b-0">{inner}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
