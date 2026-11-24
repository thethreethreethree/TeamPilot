"use client";

import { useEffect, useState } from "react";

/**
 * Keyword tracker hits on one phone/video session (RSS Phase 3, Gong F11.1): "Competitors · 03:12 · Customer".
 * Tapping a chip seeks the player when the page provides one and the hit has a time; a hit with no time (an
 * older transcript with no wall clock) is shown without one rather than pointing at 0:00.
 */
type Hit = { trackerId: string; name: string; atMs: number | null; speaker: string; matched: string; smart?: boolean };

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const WHO: Record<string, string> = { rep: "Rep", customer: "Customer", unknown: "Unattributed" };

export function TrackerHitChips({ sessionId, onSeek }: { sessionId: string; onSeek?: (seconds: number) => void }) {
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/tracker-hits`)
      .then(async (r) => (r.ok ? ((await r.json()) as { hits: Hit[] }) : null))
      .then((j) => {
        if (live && j) setHits(j.hits);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionId]);

  if (!hits || hits.length === 0) return null;
  return (
    <section className="rounded-2xl border border-default bg-base p-4" aria-label="Keyword trackers">
      <h2 className="mb-2 text-sm font-semibold text-primary">Keyword trackers</h2>
      <div className="flex flex-wrap gap-1.5">
        {hits.map((h, i) => {
          const label = `${h.name} · ${h.atMs === null ? "no time" : clock(h.atMs)} · ${WHO[h.speaker] ?? h.speaker} · ${h.smart ? "like " : ""}“${h.matched}”`;
          return onSeek && h.atMs !== null ? (
            <button
              key={i}
              type="button"
              onClick={() => onSeek(h.atMs! / 1000)}
              className="rounded-lg border border-default px-2 py-0.5 text-xs text-secondary hover:text-primary"
            >
              {label}
            </button>
          ) : (
            <span key={i} className="rounded-lg border border-default px-2 py-0.5 text-xs text-secondary">
              {label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
