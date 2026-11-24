"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useIsSalesCoachManager, useCurrentUserRole, isCompanyAdminRole } from "@/lib/hooks/useCurrentUserRole";
import type { KeyMoment } from "@/lib/coach/recordings/keyMoments";

/**
 * Comments on a Remote Sales call (gap found in the 2026-11-22 Gong re-grade, F9.8 / F16.4).
 *
 * WHY THIS EXISTS. Manager comments (with @mentions and who-can-read, 0293/0296) were written only from Coach
 * Assessment → Recordings, which lists in-person calls since the Remote Sales separation (0301). A rep's feedback
 * request on a phone/video call lands in the Coaching inbox, which says the manager answers "on the call" — and the
 * call page had no comment box. A request could not be answered that way. This puts the same comment on the call.
 *
 * ONE WRITER, ONE READER, BOTH REUSED (§2.2): it posts to /api/coach/sales-session/pitch-recordings/comment (the
 * only writer; it stamps the author, checks the reporting tree and the mentions) and reads the comments back from
 * /api/coach/sales-session/pitch-recordings?pitchId=…, whose rows are what recording_comments' RLS lets this viewer
 * see (a rep sees only sent comments on their own call). No second copy of "who may read this".
 * A comment is keyed to the call's SCORE row, so a call that is not scored yet says so instead of offering a box
 * that would fail.
 */
type Person = { id: string; name: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** "1:05" or "65" → 65 seconds; null when it isn't a time. */
export function parseClock(v: string): number | null {
  const t = v.trim();
  if (!t) return 0;
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d{1,5}$/.test(t) ? Number(t) : null;
}

export function RemoteCallComments({ sessionId, onSeek }: { sessionId: string; onSeek?: (s: number) => void }) {
  const scManager = useIsSalesCoachManager();
  const role = useCurrentUserRole();
  const isManager = scManager || isCompanyAdminRole(role);
  const [pitch, setPitch] = useState<{ id: string; repId: string } | null | undefined>(undefined);
  const [comments, setComments] = useState<KeyMoment[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coach/sales-session/pitch-score?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const p = ((await r.json()) as { pitch?: { id: string; repId: string } | null }).pitch ?? null;
      setPitch(p);
      if (!p) return;
      const d = await fetch(`/api/coach/sales-session/pitch-recordings?pitchId=${encodeURIComponent(p.id)}`, { cache: "no-store" });
      if (!d.ok) throw new Error(String(d.status));
      const j = (await d.json()) as { moments?: KeyMoment[]; viewerId?: string };
      setComments((j.moments ?? []).filter((m) => m.kind === "comment"));
      setViewerId(j.viewerId ?? null);
    } catch {
      setFailed(true);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Nothing to say to a rep with no comments: an empty panel on every call trains them to stop looking.
  if (!isManager && (failed || !comments || comments.length === 0)) return null;

  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Comments on this call">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        {isManager ? "Comments" : "From your manager"}
      </h3>
      {failed ? (
        <p className="text-xs text-muted">Couldn&apos;t load the comments on this call. Refresh to try again.</p>
      ) : pitch === undefined ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : pitch === null ? (
        <p className="text-xs text-secondary">Comments open once this call is scored.</p>
      ) : (
        <>
          {comments && comments.length > 0 ? (
            <ul className="space-y-2">
              {comments.map((c) => (
                <CommentItem key={c.id} c={c} mine={!!viewerId && c.authorId === viewerId} onSeek={onSeek} onChanged={() => void load()} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-secondary">No comments on this call yet.</p>
          )}
          {isManager && <Composer pitchId={pitch.id} repId={pitch.repId} viewerId={viewerId} onSaved={() => void load()} />}
        </>
      )}
    </section>
  );
}

function Composer({ pitchId, repId, viewerId, onSaved }: { pitchId: string; repId: string; viewerId: string | null; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [at, setAt] = useState("0:00");
  const [visibility, setVisibility] = useState<"everyone" | "named" | "only_me">("everyone");
  const [mentions, setMentions] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { members?: Array<{ id: string; full_name?: string | null }> } | null) => {
        if (!live || !d?.members) return;
        setPeople(d.members.filter((m) => m.id !== viewerId).map((m) => ({ id: m.id, name: m.full_name ?? "Unnamed teammate" })));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [viewerId]);

  const atS = parseClock(at);
  const save = async (sendToRep: boolean) => {
    if (!text.trim() || busy || atS === null) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/coach/sales-session/pitch-recordings/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchId, timestampS: atS, body: text.trim(), sendToRep, visibility, mentions: visibility === "only_me" ? [] : mentions }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; notified?: boolean; mentioned?: number };
      if (!res.ok) {
        setSaid(d.error ?? "Could not save the comment.");
        return;
      }
      setText("");
      setMentions([]);
      const told = d.mentioned ? ` ${d.mentioned} mentioned ${d.mentioned === 1 ? "person was" : "people were"} told.` : "";
      setSaid(
        (visibility === "only_me"
          ? `Saved at ${clock(atS)} as a note only you can see.`
          : sendToRep
            ? d.notified
              ? `Sent to the rep at ${clock(atS)}.`
              : `Saved at ${clock(atS)} and visible to the rep, but the notification did not go out.`
            : `Saved at ${clock(atS)}. Not sent — the rep cannot see it yet.`) + told,
      );
      onSaved();
    } catch {
      setSaid("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-subtle pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="rc-at" className="text-xs text-muted">At</label>
        <input
          id="rc-at"
          value={at}
          onChange={(e) => setAt(e.currentTarget.value)}
          inputMode="numeric"
          className="w-16 rounded-lg border border-subtle bg-base px-2 py-1 text-xs tabular-nums text-primary"
          aria-invalid={atS === null}
        />
        <span className="text-[11px] text-muted">m:ss into the call</span>
      </div>
      <label htmlFor="rc-text" className="sr-only">Comment</label>
      <textarea
        id="rc-text"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        rows={2}
        maxLength={2000}
        placeholder="What should the rep hear here?"
        className="mt-2 w-full rounded-lg border border-subtle bg-base p-2 text-sm text-primary"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <label htmlFor="rc-vis" className="text-muted">Who can read it</label>
        <select
          id="rc-vis"
          value={visibility}
          onChange={(e) => setVisibility(e.currentTarget.value as typeof visibility)}
          className="rounded-lg border border-subtle bg-base px-2 py-1 text-xs text-primary"
        >
          <option value="everyone">Everyone who can see this call</option>
          <option value="named">Only the people I mention</option>
          <option value="only_me">Only me</option>
        </select>
      </div>
      {visibility !== "only_me" && people && people.length > 0 && (
        <fieldset className="mt-2">
          <legend className="mb-1 text-xs text-muted">Mention (they&apos;re notified)</legend>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={mentions.includes(p.id)}
                onClick={() => setMentions((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                className={`rounded-full border px-2 py-0.5 text-xs ${mentions.includes(p.id) ? "border-brand bg-brand/10 text-primary" : "border-subtle text-muted hover:text-primary"}`}
              >
                @{p.name}
                {p.id === repId ? " (rep)" : ""}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !text.trim() || atS === null || visibility === "only_me"}
          title={visibility === "only_me" ? "A note only you can see isn't sent to the rep." : undefined}
          onClick={() => void save(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Save and send to rep
        </button>
        <button
          type="button"
          disabled={busy || !text.trim() || atS === null}
          onClick={() => void save(false)}
          className="rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:text-primary disabled:opacity-50"
        >
          Save privately
        </button>
      </div>
      {atS === null && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Write the time as m:ss, for example 1:05.</p>}
      {said && <p className="mt-2 text-xs text-muted">{said}</p>}
    </div>
  );
}

/**
 * One comment. Its author can edit or remove it (0333): each change is a new revision, never an overwrite, and the
 * comment shows "edited". Removing asks first, since the rep may already have read it.
 */
function CommentItem({ c, mine, onSeek, onChanged }: { c: KeyMoment; mine: boolean; onSeek?: (s: number) => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.detail ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (payload: { body?: string; remove?: boolean }) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/sales-session/pitch-recordings/comment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: c.id, ...payload }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setErr(j.error ?? "Couldn't save the change.");
      setEditing(false);
      setConfirmRemove(false);
      onChanged();
    } catch {
      setErr("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-lg border border-subtle bg-base/40 p-3">
      <p className="text-[11px] tabular-nums text-muted">
        {c.atSeconds !== null ? (
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => onSeek?.(c.atSeconds ?? 0)} disabled={!onSeek}>
            At {clock(c.atSeconds)}
          </button>
        ) : (
          "On this call"
        )}{" "}
        · {c.label}
        {c.edited ? " · edited" : ""}
      </p>
      {editing ? (
        <div className="mt-1 space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            maxLength={2000}
            rows={3}
            aria-label="Edit comment"
            className="w-full rounded-lg border border-default bg-surface p-2 text-sm text-primary"
          />
          <div className="flex gap-2 text-xs">
            <button type="button" disabled={busy || !text.trim()} onClick={() => void send({ body: text })} className="rounded-lg bg-brand px-2.5 py-1 font-semibold text-black disabled:opacity-50">
              Save
            </button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setText(c.detail ?? ""); }} className="px-1 text-muted hover:text-primary">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-primary">{c.detail}</p>
      )}
      {mine && !editing && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className="text-secondary hover:text-primary">
            Edit
          </button>
          {confirmRemove ? (
            <>
              <span className="text-secondary">Remove it? The rep may already have read it.</span>
              <button type="button" disabled={busy} onClick={() => void send({ remove: true })} className="font-semibold text-primary hover:underline">
                Remove
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmRemove(false)} className="text-muted hover:text-primary">
                Keep it
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className="text-secondary hover:text-primary">
              Remove
            </button>
          )}
        </div>
      )}
      {err && <p role="status" className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{err}</p>}
    </li>
  );
}
