"use client";

import { useEffect, useState } from "react";

/**
 * Processing stage chips for a phone/video session (RSS Phase 1, Gong F6.6; docs/rss/docs/06-UI-SPEC.md):
 * Uploading → Transcribing → Analyzing → Scoring → Ready. The current stage is filled, the rest outlined; a
 * failure is one bordered chip carrying the reason in words ("No speech heard"). Never colour alone: the
 * current chip also reads "now", and the failure chip says what happened.
 *
 * Renders, never derives: the stage comes from GET /api/coach/sales-session/:id/stage (remoteStage). Polls
 * every 10 s until the session reaches an end state, then stops. A door session or a meeting answers
 * `remote: false` and nothing is shown.
 */
type Wire =
  | { remote: false }
  | {
      remote: true;
      state: string;
      failure: { code: string; label: string } | null;
      chips: { state: string; label: string }[];
    };

const END_STATES = new Set(["scored", "failed", "not_scored", "live"]);

export function StageChips({ sessionId }: { sessionId: string }) {
  const [wire, setWire] = useState<Wire | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`/api/coach/sales-session/${encodeURIComponent(sessionId)}/stage`);
        if (!live) return;
        if (!r.ok) return; // a failed read shows nothing rather than a wrong stage
        const w = (await r.json()) as Wire;
        setWire(w);
        if (w.remote && !END_STATES.has(w.state)) timer = setTimeout(() => void tick(), 10_000);
      } catch {
        /* network blip: the next visit shows the stage */
      }
    };
    void tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  if (!wire || !wire.remote || wire.state === "live") return null;

  if (wire.failure) {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/60 px-3 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400"
      >
        {wire.state === "not_scored" ? "Not scored" : "Stopped"}: {wire.failure.label}
      </p>
    );
  }

  const current = wire.chips.findIndex((c) => c.state === wire.state);
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Processing">
      {wire.chips.map((c, i) => {
        const isNow = i === current;
        const done = current >= 0 && i < current;
        return (
          <li
            key={c.state}
            aria-current={isNow ? "step" : undefined}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isNow ? "bg-ember-400 text-ink-950" : done ? "border border-default text-secondary" : "border border-default text-muted"
            }`}
          >
            {done ? "✓ " : ""}
            {c.label}
            {isNow && wire.state !== "scored" ? " · now" : ""}
          </li>
        );
      })}
    </ol>
  );
}
