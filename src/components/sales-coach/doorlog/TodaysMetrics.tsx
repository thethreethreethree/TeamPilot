"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, DoorOpen, MessageSquare, TrendingUp, Lightbulb, Loader2 } from "lucide-react";

/**
 * Today's Metrics (Macro Mode — founder spec 2026-08-19). The 1-page field read: the Next-Door focus, the KPI
 * trio (doors / conversations / sales), the Score Chart across the period's analyzed pitches, and the day's
 * growth opportunities. Day/Week/Month/All-Time tabs (moved here off the Report Card). Read-only; the pattern
 * data is precomputed by the rollup. Every number is real (§3.4) — a load error is honest, never a blank zero.
 */

const PERIODS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all_time", label: "All Time" },
] as const;

// The founder's five Score-Chart dimensions, in order. Only dims PRESENT in the data render (older pitches
// scored under the v1 rubric lack talk_listen/questions — showing a phantom 0 would be a lie).
const SCORE_ORDER = ["objection", "talk_listen", "questions", "tone", "close"] as const;
const SCORE_LABEL: Record<string, string> = {
  objection: "Objection",
  talk_listen: "Talk / Listen",
  questions: "Questions",
  tone: "Tone",
  close: "Close",
};

type Metrics = {
  kpi: { doorsKnocked: number; conversations: number; sold: number };
  scores: Record<string, number>;
  focus: string | null;
  opportunities: string[];
};

export function TodaysMetrics() {
  const [period, setPeriod] = useState<string>("day");
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/coach/sales-session/todays-metrics?period=${p}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        // A load FAILURE must never render as a zeroed metrics page — a rep would think they'd done nothing
        // (error dressed as no-data, the honesty thesis). Surface it as an honest, retryable error.
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const scoreDims = SCORE_ORDER.filter((d) => typeof data?.scores?.[d] === "number");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-bold text-primary mb-4">Today&apos;s Metrics</h1>

      {/* Period selector (moved here off the Report Card) */}
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

      {error ? (
        <div className="glass-card p-5 border border-red-500/30">
          <p className="text-sm text-red-300">
            Couldn&apos;t load your metrics — this is an error, not an empty day. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void load(period)}
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
      ) : (
        <div className="space-y-6">
          {/* Next Door focus — the #1 recurring growth opportunity, framed as a 10-door focus. */}
          <section className="rounded-2xl border border-ember-400/40 bg-ember-400/[0.06] p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-4 h-4 text-brand" aria-hidden />
              <h2 className="text-xs font-bold uppercase tracking-wide text-brand">Next Door focus</h2>
            </div>
            {data?.focus ? (
              <>
                <p className="text-base font-semibold text-primary leading-snug text-balance">{data.focus}</p>
                <p className="text-[11px] text-muted mt-1.5">
                  Focus on this for your next 10 doors, then come back for a new one.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Your focus appears once you&apos;ve logged a few analyzed pitches — it&apos;s the one habit worth
                drilling next.
              </p>
            )}
          </section>

          {/* KPI trio */}
          <section className="grid grid-cols-3 gap-3">
            <Kpi icon={DoorOpen} label="Doors Knocked" value={data?.kpi.doorsKnocked ?? 0} />
            <Kpi icon={MessageSquare} label="Conversations" value={data?.kpi.conversations ?? 0} />
            <Kpi icon={TrendingUp} label="Sales" value={data?.kpi.sold ?? 0} accent />
          </section>

          {/* Score Chart */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary mb-3">Score Chart</h2>
            {scoreDims.length === 0 ? (
              <p className="text-sm text-muted">
                No scored pitches yet this {PERIODS.find((p) => p.key === period)?.label.toLowerCase()} — the chart
                fills in as your recorded pitches get analyzed.
              </p>
            ) : (
              <div className="glass-card p-4 space-y-3">
                {scoreDims.map((dim) => {
                  const val = data!.scores[dim]!;
                  return (
                    <div key={dim}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-secondary">{SCORE_LABEL[dim] ?? dim}</span>
                        <span className="text-primary tabular-nums">{val}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-ember-400 rounded-full"
                          style={{ width: `${Math.max(0, Math.min(100, val))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Opportunities to grow */}
          {data && data.opportunities.length > 0 && (
            <section>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-secondary mb-3">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" aria-hidden /> Opportunities to grow
              </h2>
              <ul className="space-y-1.5">
                {data.opportunities.map((o, i) => (
                  <li key={i} className="text-sm text-secondary leading-relaxed">
                    • {o}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof DoorOpen;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-2 py-3 flex flex-col items-center justify-center text-center gap-1 ${
        accent ? "border-ember-400/40 bg-ember-400/[0.08]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <Icon className={`w-4 h-4 ${accent ? "text-brand" : "text-muted"}`} aria-hidden />
      <span className={`text-lg font-bold tabular-nums ${accent ? "text-brand" : "text-primary"}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wide text-muted font-bold leading-tight">{label}</span>
    </div>
  );
}
