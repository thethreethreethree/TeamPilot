"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, Target, MessageSquareText, Gauge, Sparkles, Info, Loader2, ChevronRight } from "lucide-react";

/**
 * /dashboard/sales-coach/kpi — KPI Analytics (SalesCoach-KPI-System.md).
 *
 * Renders the caller's OWN KPIs, computed on-read via /api/coach/kpi/me. Layer 1/2 metrics that are wired
 * show a real value once past the Understanding Gate (>= 5 sessions) — otherwise "building". Metrics not yet
 * computed (Sales cycle, Win/loss, Quota, Talk-ratio, Objections, all of Layer 3/4) show "building" too, so
 * the surface never fabricates a number. Self-baseline framing throughout; Reliance Reduction featured.
 */

type MetricResult = { value: number | null; sampleSize: number; gated: boolean; sourceSessionIds: string[] };
type SessionInfo = { label: string | null; startedAt: string; outcome: string | null };
type KpiResponse = {
  sessionCount: number;
  minSessions: number;
  metrics: Record<string, MetricResult>;
  sessions: Record<string, SessionInfo>;
};

type Fmt = "pct" | "money" | "num" | "min" | "score" | "slope";
type Metric = { name: string; note: string; apiKey?: string; fmt?: Fmt; headline?: boolean };
type Layer = { key: string; title: string; subtitle: string; icon: typeof Target; metrics: Metric[] };

const LAYERS: Layer[] = [
  {
    key: "outcomes",
    title: "Layer 1 · Sales outcomes",
    subtitle: "Results — the objective bottom line.",
    icon: Target,
    metrics: [
      { name: "Conversion rate", note: "sold ÷ opportunities", apiKey: "conversionRate", fmt: "pct" },
      { name: "Close rate", note: "won ÷ resolved", apiKey: "closeRate", fmt: "pct" },
      { name: "Average deal size", note: "revenue ÷ deals won", apiKey: "avgDealSize", fmt: "money" },
      { name: "Total revenue", note: "sum of won deal values", apiKey: "revenue", fmt: "money" },
      { name: "Sales cycle length", note: "avg close − first contact" },
      { name: "Quota attainment", note: "actual ÷ target" },
    ],
  },
  {
    key: "activity",
    title: "Layer 2 · Activity",
    subtitle: "Leading indicators — the effort behind the results.",
    icon: Gauge,
    metrics: [
      { name: "Sessions per day", note: "your call volume", apiKey: "sessionsPerDay", fmt: "num" },
      { name: "Avg session duration", note: "minutes per call", apiKey: "avgSessionDurationMin", fmt: "min" },
      { name: "Talk-to-listen ratio", note: "your talk ÷ customer talk" },
      { name: "Objections per session", note: "and how many you resolve" },
      { name: "Follow-up rate", note: "prospects re-contacted" },
    ],
  },
  {
    key: "quality",
    title: "Layer 3 · Conversation quality",
    subtitle: "The how — scored 0–100 from the transcript, with cited evidence.",
    icon: MessageSquareText,
    metrics: [
      { name: "Discovery quality", note: "did you learn before you pitched?", apiKey: "l3_question_rate", fmt: "score" },
      { name: "Rapport & tone", note: "early connection signals", apiKey: "l3_tone", fmt: "score" },
      { name: "Objection handling", note: "how you met resistance", apiKey: "l3_objection", fmt: "score" },
      { name: "Opener", note: "how you started the call", apiKey: "l3_opener", fmt: "score" },
      { name: "Closing technique", note: "was the ask made, and when?", apiKey: "l3_close", fmt: "score" },
      { name: "Next-step / commitment", note: "did you lock a next step?", apiKey: "l3_next_step", fmt: "score" },
    ],
  },
  {
    key: "growth",
    title: "Layer 4 · Coaching & growth",
    subtitle: "The differentiator — is the coaching actually working?",
    icon: Sparkles,
    metrics: [
      { name: "Reliance reduction", note: "cue-frequency slope — negative means you need fewer cues over time", apiKey: "relianceReduction", fmt: "slope", headline: true },
      { name: "Cue acceptance rate", note: "cues you acted on ÷ delivered", apiKey: "cueAcceptanceRate", fmt: "pct" },
      { name: "Cue-to-outcome correlation", note: "did acting on a cue improve the result?" },
      { name: "Skill progression", note: "Δ in your quality scores vs. your own baseline" },
      { name: "Recommendation uptake", note: "did last session's advice show up this session?" },
      { name: "Consistency", note: "how steady you are, session to session" },
    ],
  },
];

function fmtValue(v: number, fmt?: Fmt): string {
  if (fmt === "pct") return `${v}%`;
  if (fmt === "money") return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (fmt === "min") return `${v} min`;
  if (fmt === "score") return `${v} / 100`;
  if (fmt === "slope") return `${v > 0 ? "+" : ""}${v}/session`;
  return v.toLocaleString();
}

export default function KpiAnalyticsPage() {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/coach/kpi/me");
        if (res.ok && alive) setData(await res.json());
      } catch {
        /* leave data null → everything shows "building" */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const renderMetricValue = (m: Metric) => {
    if (!m.apiKey) return <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5">building…</span>;
    const r = data?.metrics?.[m.apiKey];
    if (!r || r.value === null) {
      return <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5">building…</span>;
    }
    return (
      <span className="text-right shrink-0">
        <span className={`block text-sm font-semibold tabular-nums ${m.headline ? "text-emerald-300" : "text-primary"}`}>
          {fmtValue(r.value, m.fmt)}
        </span>
        <span className="block text-[9px] text-muted font-mono">n={r.sampleSize}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand" aria-hidden />
          <h1 className="text-lg font-semibold text-primary">KPI Analytics</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          Measure growth, not just results — compared to your own past, never a leaderboard.
        </p>
      </header>

      <section className="rounded-2xl border border-ember-400/25 bg-ember-400/[0.05] p-4 mb-5">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <div className="text-xs text-secondary leading-relaxed space-y-1.5">
            <p>
              <strong className="text-primary">These numbers are yours.</strong> Every KPI is measured
              against <em>your own</em> baseline — how you&apos;re doing versus how you were doing, not versus
              your teammates.
            </p>
            <p>
              <strong className="text-primary">They build from your sessions.</strong> A metric stays{" "}
              <span className="font-mono text-muted">building…</span> until you&apos;ve logged at least{" "}
              {data?.minSessions ?? 5} relevant sessions — an honest &quot;insufficient data&quot;, never a
              guessed number.
              {data && (
                <>
                  {" "}
                  You&apos;ve logged <strong className="text-primary">{data.sessionCount}</strong> so far.
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-emerald-400" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">Reliance reduction</h2>
          <span className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-mono">headline</span>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          The single most important measure: fewer live cues over time while performance holds or rises means
          you&apos;re internalizing the skill, not renting it — the one metric no tool without a live AI coach
          can measure.
        </p>
        {(() => {
          const r = data?.metrics?.relianceReduction;
          if (!r || r.value === null) {
            return (
              <p className="text-[11px] text-muted mt-2 font-mono">
                building… — activates once you have a cue-frequency trend across {data?.minSessions ?? 5}+ sessions.
              </p>
            );
          }
          const v = r.value;
          const declining = v < 0;
          return (
            <p className="text-xs mt-2">
              <span
                className={
                  declining ? "text-emerald-300 font-semibold" : v === 0 ? "text-secondary" : "text-amber-300"
                }
              >
                {declining
                  ? "Declining — you're needing fewer cues over time (the coaching is landing)"
                  : v === 0
                    ? "Flat — steady cue use"
                    : "Rising — needing more cues lately"}
              </span>{" "}
              <span className="font-mono text-muted tabular-nums">
                ({v > 0 ? "+" : ""}
                {v} cues/session · n={r.sampleSize})
              </span>
            </p>
          );
        })()}
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted py-3 mb-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Computing your KPIs…
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LAYERS.map((layer) => {
          const Icon = layer.icon;
          return (
            <section key={layer.key} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">{layer.title}</h2>
              </div>
              <p className="text-[11px] text-muted mt-0.5 mb-3">{layer.subtitle}</p>
              <ul className="space-y-2">
                {layer.metrics.map((m) => {
                  const r = m.apiKey ? data?.metrics?.[m.apiKey] : undefined;
                  const canDrill = !!r && r.value !== null && r.sourceSessionIds.length > 0;
                  const rowKey = `${layer.key}:${m.name}`;
                  const open = expanded === rowKey;
                  return (
                    <li key={m.name}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className={`block text-xs ${m.headline ? "font-semibold text-emerald-300" : "font-medium text-primary"}`}>
                            {m.name}
                          </span>
                          <span className="block text-[11px] text-muted leading-snug">{m.note}</span>
                        </span>
                        {canDrill ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : rowKey)}
                            className="text-right shrink-0 group"
                            aria-expanded={open}
                          >
                            {renderMetricValue(m)}
                            <span className="block text-[9px] text-brand/70 group-hover:text-brand">
                              {open ? "hide sources" : "view sources →"}
                            </span>
                          </button>
                        ) : (
                          renderMetricValue(m)
                        )}
                      </div>
                      {open && r && (
                        <ul className="mt-1.5 ml-1 border-l border-default pl-2.5 space-y-1">
                          {r.sourceSessionIds.slice(0, 15).map((sid) => {
                            const s = data?.sessions?.[sid];
                            return (
                              <li key={sid}>
                                <Link
                                  href={`/dashboard/sales-coach/${sid}`}
                                  className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-brand"
                                >
                                  <ChevronRight className="w-3 h-3 shrink-0" aria-hidden />
                                  <span className="truncate">
                                    {s?.label || "Session"}
                                    {s?.startedAt ? ` · ${new Date(s.startedAt).toLocaleDateString()}` : ""}
                                    {s?.outcome ? ` · ${s.outcome}` : ""}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                          {r.sourceSessionIds.length > 15 && (
                            <li className="text-[10px] text-muted">
                              +{r.sourceSessionIds.length - 15} more
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-muted mt-6 text-center">
        Wired Layer 1–2 metrics compute live from your sessions; the rest activate as more of the measurement
        layer is built. Nothing shows a number it can&apos;t trace to your real sessions.
      </p>
    </div>
  );
}
