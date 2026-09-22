"use client";

import { useState } from "react";
import { MessageSquarePlus, CheckCircle2, Dumbbell, CalendarClock, Flag, Film } from "lucide-react";
import Link from "next/link";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";
import { isNote } from "@/lib/coach/patterns/eventPermission";

/**
 * COACHING NOTES and the four actions — from the Patterns board opened at full resolution
 * 2026-09-22.
 *
 * WHAT THIS UNBLOCKS, which is more than four buttons. `pattern_events` has existed since 0258
 * with six valid kinds and no writer, and `statusOf` needs a coaching instant to return
 * `coaching`, `improving` or `stalled`. **Three of the five statuses were unreachable**: every
 * pattern in the product was New or Fixed and the lifecycle the guide describes was decorative.
 * The Rep progress timeline drew bars with no markers for the same reason.
 *
 * THE BANNER ON THIS BOARD IS THE BRIEF FOR THE REP HALF:
 *
 *     Reps see their own Pattern Interrupt page, clips and your notes included, so nothing here
 *     is a surprise.
 *
 * So a rep sees the notes and can reply in the same list — their entry on the render reads
 * "Reviewed. Running it before shifts this week." That reply is the §3.3 participation this
 * feature was missing: until now the system found a pattern, a manager read it, and the person
 * it was about had no way to answer.
 *
 * A NOTE IS AN EVENT WITH A BODY. `isNote` is imported rather than re-expressed, so the kind
 * decides the timeline marker and the body decides whether it also appears here — one "Mark as
 * coached" carrying an instruction is both, which is what the board shows.
 */

type Props = {
  pattern: PatternRow;
  isManager: boolean;
  /** The signed-in user, so the rep's own entries can be named and their actions offered. */
  viewerId: string | null;
  nameByActor: Record<string, string>;
  /** Re-read after a write rather than patching a local copy — the server owns the log. */
  onWritten: () => void;
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function PatternActions({ pattern, isManager, viewerId, nameByActor, onWritten }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const ownsIt = viewerId !== null && pattern.repId === viewerId;
  const notes = (pattern.events ?? []).filter(isNote);

  /**
   * The most recent drill a manager assigned on this pattern, or null.
   *
   * FOUNDER RULING 2026-09-22: "Assign Role Play drill" must put a drill where the rep can do it,
   * not merely record that one was assigned. The label is a verb and a manager reasonably expects
   * the drill to appear.
   *
   * It appears HERE rather than in a queue, because Role Play already takes `?focus=` and drives
   * the whole drill from it — the prospect creates moments for that skill and the end review
   * scores it. So the assignment does not need a queue table; it needs the event to become a
   * link, seeded with this pattern's own label. A new table would be a second record of a thing
   * `pattern_events` already holds (§3.1).
   */
  const assignedDrill = (pattern.events ?? [])
    .filter((e) => e.kind === "drill_assigned")
    .sort((a, b) => b.at.localeCompare(a.at))[0];

  const append = async (kind: string, withBody: boolean) => {
    if (busy) return;
    if (withBody && !draft.trim()) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/coach/sales-session/patterns/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patternId: pattern.id,
          kind,
          ...(withBody || draft.trim() ? { body: draft.trim() } : {}),
        }),
      });
      const d = (await res.json()) as { error?: string; closed?: boolean };
      if (!res.ok) {
        setSaid(d.error ?? "Could not record that.");
        return;
      }
      setDraft("");
      setSaid(SAID[kind] ?? "Recorded.");
      // The log is the server's. Re-reading also refreshes the STATUS, which is the point of
      // "Mark as coached" — the pattern moves from New to Coaching and the manager sees it.
      onWritten();
    } catch {
      setSaid("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-default pt-4">
      {/* ── From the tape ─────────────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted">From the tape</p>
        {/* The clips the board draws inline are markers on the recording player, which shipped
            earlier today. Linking there rather than duplicating the player: one place decides
            where a pattern moment sits in a recording. */}
        <Link
          href={
            isManager
              ? "/dashboard/sales-coach/coach-assessment"
              : "/dashboard/sales-coach/doors/report-card"
          }
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary"
        >
          <Film className="h-3.5 w-3.5" aria-hidden />
          {isManager ? "Open the recordings" : "Open your recordings"}
        </Link>
        <p className="mt-1.5 text-[11px] text-muted">
          Every miss on this pattern is a marker on the recording it came from — click it to hear
          the moment.
        </p>
      </div>

      {/* ── The assigned drill, on the rep's side ────────────────────────────────────────── */}
      {ownsIt && assignedDrill && (
        <div className="rounded-lg border border-ember-400/40 bg-ember-400/[0.08] p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
            Your manager assigned a drill
          </p>
          <p className="mt-1 text-xs text-secondary">
            Practice this exact pattern against an AI prospect. The review at the end scores you
            on it.
          </p>
          <Link
            href={`/dashboard/sales-coach/roleplay?focus=${encodeURIComponent(pattern.label)}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-medium text-ink-950"
          >
            <Dumbbell className="h-3.5 w-3.5" aria-hidden />
            Start the drill
          </Link>
          <p className="mt-1.5 text-[11px] text-muted">Assigned {day(assignedDrill.at)}.</p>
        </div>
      )}

      {/* A manager sees whether the drill they assigned is actually reachable, which is the half
          of "assign" that used to be missing. */}
      {isManager && assignedDrill && (
        <p className="text-[11px] text-muted">
          Drill assigned {day(assignedDrill.at)} — it shows on this rep&apos;s own Pattern
          Interrupt page as a Start the drill button, seeded with this pattern.
        </p>
      )}

      {/* ── Coaching notes ────────────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted">Coaching notes</p>
        {notes.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted">
            {isManager
              ? "Nothing written down yet. A note here is shown to the rep."
              : "Your manager has not written anything about this one yet."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {notes.map((n, i) => {
              const mine = n.actorId !== null && n.actorId === viewerId;
              const who = n.actorId ? (nameByActor[n.actorId] ?? (mine ? "You" : "Manager")) : "System";
              return (
                <li key={`${n.at}-${i}`}>
                  <p
                    className={`text-[11px] font-semibold ${
                      n.kind === "rep_reviewed" || n.kind === "clip_disputed"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-brand"
                    }`}
                  >
                    {who} · {day(n.at)}
                    {n.kind === "clip_disputed" && " · disputed a clip"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-secondary">{n.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── The composer ──────────────────────────────────────────────────────────────────── */}
      {(isManager || ownsIt) && (
        <div>
          <label htmlFor={`note-${pattern.id}`} className="sr-only">
            Add a note
          </label>
          <textarea
            id={`note-${pattern.id}`}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            rows={2}
            maxLength={2000}
            placeholder={
              isManager
                ? "What should this rep do differently? They will see this."
                : "Reply to your manager about this pattern."
            }
            className="w-full rounded-lg border border-default bg-base p-2 text-xs text-primary"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            {isManager && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void append("drill_assigned", false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950"
                >
                  <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                  Assign Role Play drill
                </button>
                <button
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void append("note", true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                  Add note
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void append("coached", false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Mark as coached
                </button>
                <button
                  type="button"
                  disabled
                  title="Scheduling is not wired yet — this creates no calendar event."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-muted opacity-50"
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  Schedule check-in
                </button>
              </>
            )}

            {ownsIt && (
              <>
                {/* The rep can only acknowledge coaching that happened. Acknowledging nothing
                    would produce "1 of 0" on the Rep reviewed tile. */}
                {pattern.coachedAt !== null && !pattern.repReviewed && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void append("rep_reviewed", false)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Reviewed
                  </button>
                )}
                {!isManager && (
                  <button
                    type="button"
                    disabled={busy || !draft.trim()}
                    onClick={() => void append("note", true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                    Reply
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void append("clip_disputed", true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-muted hover:text-primary disabled:opacity-50"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  This looks wrong
                </button>
              </>
            )}
          </div>

          {said && <p className="mt-2 text-[11px] text-muted">{said}</p>}

          {isManager && (
            // Said before they press it, not discovered afterwards. The banner at the top of this
            // page already promises the rep sees it; this is the same promise at the point of
            // writing (A10).
            <p className="mt-2 text-[11px] text-muted">
              Anything recorded here is visible to the rep on their own Pattern Interrupt page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** What each action says back, in the words the board uses for it. */
const SAID: Record<string, string> = {
  coached: "Marked as coached. The pattern now tracks whether it moves.",
  drill_assigned: "Drill assigned. It shows on the rep's timeline.",
  note: "Saved. The rep can see it.",
  rep_reviewed: "Thanks — your manager can see you have read it.",
  clip_disputed: "Flagged for your manager.",
};
