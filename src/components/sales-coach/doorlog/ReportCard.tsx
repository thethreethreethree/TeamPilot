"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

/**
 * Pitch Performance (Macro Mode — renamed from "Report Card", founder spec 2026-08-19). The recordings list:
 * each pitch shows its after-pitch summary + outcome (Sold / Go Back / Not Interested…) and drills into the full
 * per-pitch analysis. The Day/Week/Month/All-Time tabs and the macro pattern summary MOVED to Today's Metrics —
 * this surface is purely the record of pitches. Read-only; a load error is honest, never a false "no pitches".
 */

const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
  sold: { label: "Sold", cls: "bg-emerald-500/15 text-emerald-400" },
  go_back: { label: "Go Back", cls: "bg-ember-400/15 text-brand" },
  non_decision_maker: { label: "Non-DM", cls: "bg-surface text-secondary" },
  not_interested: { label: "Not Int.", cls: "bg-surface text-muted" },
  no_answer: { label: "No Answer", cls: "bg-surface text-muted" },
};

type Pitch = {
  id: string;
  name: string;
  status: string;
  recordedAt: string;
  outcome: string;
  summary: string | null;
};

export function ReportCard() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // The pitch list is not period-scoped (it's the full recording history); the API's period param only
      // shapes the pattern summary, which now lives on Today's Metrics — so we don't pass one here.
      const res = await fetch(`/api/coach/sales-session/report-card`);
      if (res.ok) {
        const d = await res.json();
        setPitches(d.pitches ?? []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-bold text-primary">Pitch Performance</h1>
      <p className="text-xs text-muted mb-5">Your recorded pitches and their after-pitch summary.</p>

      {error ? (
        <div className="glass-card p-5 border border-red-500/30">
          <p className="text-sm text-red-300">
            Couldn&apos;t load your pitches — this is an error, not an empty history. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-sm font-semibold text-brand hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : pitches.length === 0 ? (
        <p className="text-sm text-muted">
          No pitches recorded yet. Record a pitch from the Door Log and its after-pitch summary shows up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {pitches.map((p) => {
            const badge = OUTCOME_BADGE[p.outcome] ?? { label: p.outcome, cls: "bg-surface text-muted" };
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/sales-coach/doors/report-card/${p.id}`}
                  className="glass-card p-3.5 flex items-start justify-between gap-3 hover:border-strong transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-primary truncate">{p.name}</div>
                    <div className="text-[11px] text-muted mb-1">
                      {new Date(p.recordedAt).toLocaleString()}
                      {p.status !== "complete" && (
                        <span className="ml-2 text-brand">
                          {p.status === "failed" ? "processing failed" : "processing…"}
                        </span>
                      )}
                    </div>
                    {/* The after-pitch summary inline — the recording's content (founder spec 2026-08-19). */}
                    {p.summary ? (
                      <p className="text-xs text-secondary leading-relaxed line-clamp-2">{p.summary}</p>
                    ) : p.status === "complete" ? null : (
                      <p className="text-xs text-muted italic">Summary appears once processing finishes.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
