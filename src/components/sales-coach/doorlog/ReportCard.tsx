"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Report Card — Macro Mode Tab 2. The reflective, insight-dense surface (allowed to be complex). Hero is
 * the AI macro-pattern summary (working / hurting + trend vs. the previous period) across the selected
 * period; below it, the pitch list. Precomputed by the rollup worker — no LLM cost on view.
 */

const PERIODS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all_time", label: "All Time" },
] as const;

const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
  sold: { label: "Sold", cls: "bg-emerald-500/15 text-emerald-400" },
  go_back: { label: "Go Back", cls: "bg-ember-400/15 text-brand" },
  non_decision_maker: { label: "Non-DM", cls: "bg-surface text-secondary" },
  not_interested: { label: "Not Int.", cls: "bg-surface text-muted" },
  no_answer: { label: "No Answer", cls: "bg-surface text-muted" },
};

type Summary = {
  headline: string;
  patternsGood: string[];
  patternsBad: string[];
  trend: { direction?: string; note?: string } | null;
  pitchCount: number;
};
type Pitch = { id: string; name: string; status: string; recordedAt: string; outcome: string };

export function ReportCard() {
  const [period, setPeriod] = useState<string>("week");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/sales-session/report-card?period=${p}`);
      if (res.ok) {
        const d = await res.json();
        setSummary(d.summary);
        setPitches(d.pitches ?? []);
      }
    } catch {
      /* leave prior data; the page never hard-fails */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const trendIcon =
    summary?.trend?.direction === "improving" ? (
      <TrendingUp className="w-4 h-4 text-emerald-400" aria-hidden />
    ) : summary?.trend?.direction === "regressing" ? (
      <TrendingDown className="w-4 h-4 text-red-400" aria-hidden />
    ) : (
      <Minus className="w-4 h-4 text-muted" aria-hidden />
    );

  return (
    <div className="min-h-screen bg-base px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-primary mb-4">Report Card</h1>

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.key ? "bg-ember-400 text-[#09090B]" : "bg-surface text-secondary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Pattern hero */}
      <div className="glass-card p-5 mb-6">
        {loading ? (
          <p className="text-sm text-muted">Loading patterns…</p>
        ) : !summary ? (
          <p className="text-sm text-muted">
            No pattern summary yet for this period — it builds as pitches come in and get analyzed.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-2 mb-4">
              {trendIcon}
              <div>
                <h2 className="text-base font-bold text-primary leading-snug text-balance">
                  {summary.headline}
                </h2>
                {summary.trend?.note && (
                  <p className="text-xs text-muted mt-1">{summary.trend.note}</p>
                )}
                <p className="text-[11px] text-muted mt-1">
                  Across {summary.pitchCount} pitch{summary.pitchCount === 1 ? "" : "es"} this{" "}
                  {PERIODS.find((p) => p.key === period)?.label.toLowerCase()}
                </p>
              </div>
            </div>

            {summary.patternsGood.length > 0 && (
              <div className="mb-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> What's working
                </h3>
                <ul className="space-y-1.5">
                  {summary.patternsGood.map((p, i) => (
                    <li key={i} className="text-sm text-secondary leading-relaxed">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.patternsBad.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ember-400 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> Growth opportunities
                </h3>
                <ul className="space-y-1.5">
                  {summary.patternsBad.map((p, i) => (
                    <li key={i} className="text-sm text-secondary leading-relaxed">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pitch list */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary mb-3">Pitches</h2>
      {pitches.length === 0 ? (
        <p className="text-sm text-muted">No pitches recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {pitches.map((p) => {
            const badge = OUTCOME_BADGE[p.outcome] ?? { label: p.outcome, cls: "bg-surface text-muted" };
            return (
              <li key={p.id} className="glass-card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-primary truncate">{p.name}</div>
                  <div className="text-[11px] text-muted">
                    {new Date(p.recordedAt).toLocaleString()}
                    {p.status !== "complete" && (
                      <span className="ml-2 text-brand">
                        {p.status === "failed" ? "processing failed" : "processing…"}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md ${badge.cls}`}>
                  {badge.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
