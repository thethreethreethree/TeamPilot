"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMeetingCoaching } from "@/lib/coach/v5/useMeetingCoaching";
import { MeetingTrendTile } from "@/components/sales-coach/MeetingTrendTile";
import { MeetingHistoryList } from "@/components/sales-coach/MeetingHistoryList";

/**
 * MeetingCoachingPanel — the facilitator's surface for a live Meeting/Huddle Coach session (Team-Sync).
 * Setup (pick kind + where + title → create the session) → live coaching (transcript, the current cue, coach
 * controls). Mirrors the Sales LiveCoachingPanel's shape (earpiece-gated Start, prominent cue, Stop) but leaner.
 * The UX here is the agent's default (founder can refine it — §1.5.4); the coaching substance is the meeting
 * brain behind /api/coach/meeting-session/[id]/cue. Colors use the app's theme tokens (text-primary/secondary/
 * muted, bg-surface, border-default) so the panel is legible in both light and dark, not hard-coded zinc.
 */
type Kind = "meeting" | "huddle";
type Ctx = "in_person" | "video";

export function MeetingCoachingPanel({ initialPrepId }: { initialPrepId?: string } = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("meeting");
  const [context, setContext] = useState<Ctx>("in_person");
  const [title, setTitle] = useState("");
  const [earpieceOk, setEarpieceOk] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // The just-ended meeting's id, so we can offer a "review it" link before returning to setup (layer-3
  // continuity — the facilitator just ran a meeting; let them review it, not dead-end at a blank form).
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null);

  const coach = useMeetingCoaching(sessionId ?? "", kind);

  // Start the live capture ONCE, after sessionId is set — so the hook's start() closure carries the real
  // session id (starting it inline in startSession would capture the pre-create null id).
  const startedRef = useRef(false);
  useEffect(() => {
    if (!sessionId || startedRef.current) return;
    startedRef.current = true;
    void coach.start();
    // coach is a fresh object each render; gate on sessionId + the once-latch above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // End the session and return to setup — so a mic-permission failure (or a finished meeting) is never a
  // dead-end: the facilitator can start over or begin another meeting. Resets the once-latch so the next
  // created session starts cleanly. (Post-meeting Dissect is a later phase; setup is the honest MVP return.)
  function endSession() {
    coach.stop();
    startedRef.current = false;
    if (sessionId) {
      setEndedSessionId(sessionId); // remember it so we can offer the review
      // Mark the session ended server-side so ended_at ≈ now (not +6h from the auto-close cron, which would give
      // a wildly wrong meeting duration). Fire-and-forget — the UI shouldn't block on it.
      void fetch(`/api/coach/meeting-session/${sessionId}/end`, { method: "POST" }).catch(() => {});
    }
    setSessionId(null);
    setTitle("");
  }

  async function startSession() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/coach/meeting-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Carry the Prep-up link so the session binds to its agenda (the coach loads goal + topics + docs).
        body: JSON.stringify({ kind, context, title: title.trim(), ...(initialPrepId ? { prepId: initialPrepId } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { session?: { id: string }; error?: string } | null;
      if (!res.ok || !data?.session) {
        setCreateError(data?.error ?? "Couldn't start the session.");
        return;
      }
      // Setting the id triggers the start effect above (which carries the real id into the hook).
      setSessionId(data.session.id);
    } catch {
      setCreateError("Couldn't start the session.");
    } finally {
      setCreating(false);
    }
  }

  // ── ENDED — offer the review before returning to setup (layer-3 continuity) ─
  if (!sessionId && endedSessionId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <div>
          <h1 className="text-xl font-semibold text-primary">Meeting ended</h1>
          <p className="mt-1 text-sm text-secondary">
            The recording is saving now. Its review — decisions, action items, and what was left open — will be
            ready in a moment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/meeting-coach/${endedSessionId}/review`}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Review this meeting
          </Link>
          <button
            type="button"
            onClick={() => setEndedSessionId(null)}
            className="rounded-lg border border-default px-4 py-2.5 text-sm text-secondary hover:border-strong"
          >
            Start another
          </button>
        </div>
      </div>
    );
  }

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-6">
        <MeetingTrendTile />
        <div>
          <h1 className="text-xl font-semibold text-primary">Start a coached meeting</h1>
          <p className="mt-1 text-sm text-secondary">
            The coach listens and quietly cues you on facilitation — surfacing drift, undecided items, and
            unassigned actions — in your earpiece. It advises; you run the room.
          </p>
        </div>

        {initialPrepId ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            ✓ Your prep is loaded — the coach will keep this meeting on your goal + must-discuss topics.
          </p>
        ) : (
          <Link
            href="/dashboard/meeting-coach/prep"
            className="rounded-lg border border-ember-400/40 bg-ember-400/[0.06] px-3 py-2.5 text-sm text-primary hover:border-ember-400/70 transition-colors"
          >
            <span className="font-semibold">Prep this meeting first →</span>
            <span className="mt-0.5 block text-xs text-muted">
              Add the goal, must-discuss topics, and documents so the coach keeps you on the agenda.
            </span>
          </Link>
        )}

        <label className="flex flex-col gap-1 text-sm text-secondary">
          What is this?
          <div className="flex gap-2">
            {(["meeting", "huddle"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                  kind === k
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-default text-secondary hover:border-strong"
                }`}
              >
                {k}
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  {k === "meeting" ? "decisions + actions" : "fast status + blockers"}
                </span>
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm text-secondary">
          Where?
          <div className="flex gap-2">
            {(["in_person", "video"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setContext(c)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  context === c
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-default text-secondary hover:border-strong"
                }`}
              >
                {c === "in_person" ? "In person" : "Video call"}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm text-secondary">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly product sync"
            maxLength={200}
            className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-emerald-500"
          />
        </label>

        <label className="flex items-start gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={earpieceOk}
            onChange={(e) => setEarpieceOk(e.target.checked)}
            className="mt-0.5"
          />
          I have an in-ear earpiece in, so cues are private to me and don&apos;t interrupt the room.
        </label>

        {createError && <p className="text-sm text-red-400">{createError}</p>}

        <button
          type="button"
          disabled={!title.trim() || !earpieceOk || creating}
          onClick={startSession}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {creating ? "Starting…" : "Start coaching"}
        </button>

        <MeetingHistoryList />
      </div>
    );
  }

  // ── LIVE ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold capitalize text-primary">{kind} coach</h1>
          <p className="text-xs text-muted">
            {coach.status === "live"
              ? "Listening"
              : coach.status === "connecting"
                ? "Connecting…"
                : coach.status === "error"
                  ? "Connection issue"
                  : "Idle"}
          </p>
        </div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
          <div
            className="h-full bg-emerald-500 transition-[width] duration-100"
            style={{ width: `${Math.round(coach.micLevel * 100)}%` }}
          />
        </div>
      </div>

      {coach.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{coach.error}</p>}

      {/* The current cue — the point of the whole surface. */}
      <div className="min-h-[4.5rem] rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
        <p className="text-xs uppercase tracking-wide text-emerald-400/70">Coach</p>
        <p className="mt-1 text-sm text-primary">
          {coach.currentCue ?? <span className="text-muted">Quiet unless something needs your attention.</span>}
        </p>
        {coach.cueStatus && <p className="mt-2 text-xs text-muted">{coach.cueStatus}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={coach.requestCue}
          className="rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:border-strong"
        >
          Coach me now
        </button>
        <button
          type="button"
          onClick={() => coach.setAutoCoach(!coach.autoCoach)}
          className={`rounded-lg border px-3 py-2 text-sm ${
            coach.autoCoach ? "border-emerald-500 text-emerald-300" : "border-default text-secondary"
          }`}
        >
          Auto-coach {coach.autoCoach ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => coach.markNearingEnd(true)}
          className="rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:border-strong"
        >
          Wrapping up
        </button>
        <button
          type="button"
          onClick={endSession}
          className="ml-auto rounded-lg bg-surface-raised px-3 py-2 text-sm text-primary hover:opacity-90"
        >
          {coach.status === "error" ? "Back to setup" : "Stop"}
        </button>
      </div>

      {/* Rolling transcript (cue fuel — unlabeled single stream for the in-person MVP). */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-default bg-surface p-3 text-sm">
        {coach.turns.length === 0 && !coach.partial ? (
          <p className="text-muted">The conversation will appear here as it&apos;s captured.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {coach.turns.map((t, i) => (
              <p key={i} className="text-secondary">
                {t.text}
              </p>
            ))}
            {coach.partial && <p className="text-muted italic">{coach.partial}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
