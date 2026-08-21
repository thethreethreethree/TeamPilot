"use client";

import { useEffect, useRef, useState } from "react";
import { useMeetingCoaching } from "@/lib/coach/v5/useMeetingCoaching";

/**
 * MeetingCoachingPanel — the facilitator's surface for a live Meeting/Huddle Coach session (Team-Sync).
 * Setup (pick kind + where + title → create the session) → live coaching (transcript, the current cue, coach
 * controls). Mirrors the Sales LiveCoachingPanel's shape (earpiece-gated Start, prominent cue, Stop) but leaner.
 * The UX here is the agent's default (founder can refine it — §1.5.4); the coaching substance is the meeting
 * brain behind /api/coach/meeting-session/[id]/cue.
 */
type Kind = "meeting" | "huddle";
type Ctx = "in_person" | "video";

export function MeetingCoachingPanel() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("meeting");
  const [context, setContext] = useState<Ctx>("in_person");
  const [title, setTitle] = useState("");
  const [earpieceOk, setEarpieceOk] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  async function startSession() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/coach/meeting-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, context, title: title.trim() }),
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

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Start a coached meeting</h1>
          <p className="mt-1 text-sm text-zinc-400">
            The coach listens and quietly cues you on facilitation — surfacing drift, undecided items, and
            unassigned actions — in your earpiece. It advises; you run the room.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-zinc-300">
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
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {k}
                <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                  {k === "meeting" ? "decisions + actions" : "fast status + blockers"}
                </span>
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-300">
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
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {c === "in_person" ? "In person" : "Video call"}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly product sync"
            maxLength={200}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
        </label>

        <label className="flex items-start gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={earpieceOk}
            onChange={(e) => setEarpieceOk(e.target.checked)}
            className="mt-0.5"
          />
          I have an in-ear earpiece in, so cues are private to me and don&apos;t interrupt the room.
        </label>

        {createError && <p className="text-sm text-red-300">{createError}</p>}

        <button
          type="button"
          disabled={!title.trim() || !earpieceOk || creating}
          onClick={startSession}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {creating ? "Starting…" : "Start coaching"}
        </button>
      </div>
    );
  }

  // ── LIVE ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold capitalize text-zinc-100">{kind} coach</h1>
          <p className="text-xs text-zinc-500">
            {coach.status === "live"
              ? "Listening"
              : coach.status === "connecting"
                ? "Connecting…"
                : coach.status === "error"
                  ? "Connection issue"
                  : "Idle"}
          </p>
        </div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
          <div
            className="h-full bg-emerald-500 transition-[width] duration-100"
            style={{ width: `${Math.round(coach.micLevel * 100)}%` }}
          />
        </div>
      </div>

      {coach.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{coach.error}</p>}

      {/* The current cue — the point of the whole surface. */}
      <div className="min-h-[4.5rem] rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
        <p className="text-xs uppercase tracking-wide text-emerald-400/70">Coach</p>
        <p className="mt-1 text-sm text-zinc-100">
          {coach.currentCue ?? <span className="text-zinc-500">Quiet unless something needs your attention.</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={coach.requestCue}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600"
        >
          Coach me now
        </button>
        <button
          type="button"
          onClick={() => coach.setAutoCoach(!coach.autoCoach)}
          className={`rounded-lg border px-3 py-2 text-sm ${
            coach.autoCoach ? "border-emerald-500 text-emerald-300" : "border-zinc-700 text-zinc-400"
          }`}
        >
          Auto-coach {coach.autoCoach ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => coach.markNearingEnd(true)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600"
        >
          Wrapping up
        </button>
        <button
          type="button"
          onClick={coach.stop}
          className="ml-auto rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-600"
        >
          Stop
        </button>
      </div>

      {/* Rolling transcript (cue fuel — unlabeled single stream for the in-person MVP). */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
        {coach.turns.length === 0 && !coach.partial ? (
          <p className="text-zinc-600">The conversation will appear here as it&apos;s captured.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {coach.turns.map((t, i) => (
              <p key={i} className="text-zinc-300">
                {t.text}
              </p>
            ))}
            {coach.partial && <p className="text-zinc-500 italic">{coach.partial}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
