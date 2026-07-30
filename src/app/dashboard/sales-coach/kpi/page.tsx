"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, Target, MessageSquareText, Gauge, Sparkles, Info, Loader2, ChevronRight, Users, Download } from "lucide-react";
import { toCsv } from "@/lib/export/toCsv";

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
  deltas?: Record<string, number | null>;
  sessions: Record<string, SessionInfo>;
};

type TeamAgent = {
  agentId: string;
  name: string | null;
  sessionCount: number;
  conversionRate: MetricResult;
  relianceReduction: MetricResult;
};

type Fmt = "pct" | "money" | "num" | "min" | "score" | "slope" | "delta" | "corr";
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
      { name: "Talk share (yours)", note: "your share of the talking — lower leaves room to listen", apiKey: "l2_talk_ratio", fmt: "score" },
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
      { name: "Cue-to-outcome correlation", note: "does acting on cues track with winning? (association, not proof)", apiKey: "cueToOutcome", fmt: "corr" },
      { name: "Skill progression", note: "Δ in your quality scores vs. your own earlier calls", apiKey: "skillProgression", fmt: "delta" },
      { name: "Recommendation uptake", note: "did last session's advice show up this session?" },
      { name: "Consistency", note: "how steady your quality is, call to call", apiKey: "consistency", fmt: "score" },
    ],
  },
];

function fmtValue(v: number, fmt?: Fmt): string {
  if (fmt === "pct") return `${v}%`;
  if (fmt === "money") return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (fmt === "min") return `${v} min`;
  if (fmt === "score") return `${v} / 100`;
  if (fmt === "slope") return `${v > 0 ? "+" : ""}${v}/session`;
  if (fmt === "delta") return v === 0 ? "0" : `${v > 0 ? "▲ +" : "▼ "}${Math.abs(v)}`;
  if (fmt === "corr") return `r=${v > 0 ? "+" : ""}${v}`;
  return v.toLocaleString();
}

export default function KpiAnalyticsPage() {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamAgent[] | null>(null);
  // Ranking is AVAILABLE but never the default frame (spec non-negotiable): default sorts by name.
  const [teamSort, setTeamSort] = useState<"name" | "conversion" | "reliance">("name");

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
    // Manager rollup — 403 for non-managers (we just hide the section then).
    (async () => {
      try {
        const res = await fetch("/api/coach/kpi/team");
        if (res.ok && alive) {
          const j = (await res.json()) as { agents: TeamAgent[] };
          if (Array.isArray(j.agents) && j.agents.length > 0) setTeam(j.agents);
        }
      } catch {
        /* non-manager or error → no team section */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // CSV export (spec: Exports). Client-side, routed through the formula-safe toCsv writer.
  const exportCsv = () => {
    if (!data) return;
    const rows: Record<string, unknown>[] = [];
    for (const layer of LAYERS) {
      for (const m of layer.metrics) {
        const r = m.apiKey ? data.metrics?.[m.apiKey] : undefined;
        const delta = m.apiKey ? data.deltas?.[m.apiKey] : undefined;
        rows.push({
          Layer: layer.title,
          Metric: m.name,
          Value: r && r.value !== null ? r.value : "building",
          Sessions: r ? r.sampleSize : "",
          "Delta vs earlier": typeof delta === "number" ? delta : "",
        });
      }
    }
    const csv = toCsv(rows, ["Layer", "Metric", "Value", "Sessions", "Delta vs earlier"]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kpi-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMetricValue = (m: Metric) => {
    if (!m.apiKey) return <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5">building…</span>;
    const r = data?.metrics?.[m.apiKey];
    if (!r || r.value === null) {
      return <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5">building…</span>;
    }
    const delta = m.apiKey ? data?.deltas?.[m.apiKey] : null;
    return (
      <span className="text-right shrink-0">
        <span className={`block text-sm font-semibold tabular-nums ${m.headline ? "text-emerald-300" : "text-primary"}`}>
          {fmtValue(r.value, m.fmt)}
        </span>
        {typeof delta === "number" && delta !== 0 && (
          <span className="block text-[9px] font-mono text-secondary tabular-nums">
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} vs earlier
          </span>
        )}
        <span className="block text-[9px] text-muted font-mono">n={r.sampleSize}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand" aria-hidden />
            <h1 className="text-lg font-semibold text-primary">KPI Analytics</h1>
          </div>
          <p className="text-xs text-muted mt-1">
            Measure growth, not just results — compared to your own past, never a leaderboard.
          </p>
        </div>
        {data && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-secondary hover:text-primary border border-default hover:border-strong rounded-md px-2.5 py-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            Export CSV
          </button>
        )}
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

      {/* Growth summary — LEAD with what improved (spec: the agent view is growth-framed). Only shows once
          there's delta signal; counts good-direction session metrics + skill progression. */}
      {(() => {
        const goodDir = ["conversionRate", "closeRate", "avgDealSize", "sessionsPerDay"];
        const skill = data?.metrics?.skillProgression?.value ?? null;
        let up = goodDir.filter((k) => (data?.deltas?.[k] ?? 0) > 0).length;
        let down = goodDir.filter((k) => (data?.deltas?.[k] ?? 0) < 0).length;
        if (typeof skill === "number") {
          if (skill > 0) up += 1;
          else if (skill < 0) down += 1;
        }
        if (up + down === 0) return null;
        return (
          <section className="rounded-2xl border border-default bg-white/[0.02] p-4 mb-5">
            <p className="text-sm">
              <span className="font-semibold text-emerald-300">
                Since your earlier calls, you&apos;re up in {up} area{up === 1 ? "" : "s"}.
              </span>
              {down > 0 && (
                <span className="text-secondary">
                  {" "}
                  {down} to focus on next.
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted mt-1">
              Measured against your own past — the detail behind each is below.
            </p>
          </section>
        );
      })()}

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

      {team && (
        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand" aria-hidden />
            <h2 className="text-sm font-semibold text-primary">Team</h2>
            <span className="text-[10px] uppercase tracking-widest text-muted font-mono">manager view</span>
          </div>
          <p className="text-[11px] text-muted mb-2">
            Per-agent growth, each measured against their own past. Ranking is optional — the default is by
            name, not a leaderboard.
          </p>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] text-muted">Sort:</span>
            {(
              [
                ["name", "Name"],
                ["conversion", "Conversion"],
                ["reliance", "Reliance"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTeamSort(k)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  teamSort === k
                    ? "border-ember-400/50 bg-ember-400/10 text-brand"
                    : "border-default text-muted hover:text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {[...team]
              .sort((a, b) =>
                teamSort === "conversion"
                  ? (b.conversionRate.value ?? -1) - (a.conversionRate.value ?? -1)
                  : teamSort === "reliance"
                    ? (a.relianceReduction.value ?? 999) - (b.relianceReduction.value ?? 999)
                    : (a.name || "").localeCompare(b.name || "")
              )
              .map((a) => (
                <li key={a.agentId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-primary truncate">{a.name || "Agent"}</span>
                    <span className="block text-[10px] text-muted">{a.sessionCount} sessions</span>
                  </span>
                  <span className="flex items-center gap-5 shrink-0 text-right">
                    <span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted">Conversion</span>
                      <span className="block text-xs font-semibold text-primary tabular-nums">
                        {a.conversionRate.value === null ? "building…" : `${a.conversionRate.value}%`}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted">Reliance</span>
                      <span
                        className={`block text-xs font-semibold tabular-nums ${
                          a.relianceReduction.value !== null && a.relianceReduction.value < 0
                            ? "text-emerald-300"
                            : "text-primary"
                        }`}
                      >
                        {a.relianceReduction.value === null
                          ? "building…"
                          : `${a.relianceReduction.value > 0 ? "+" : ""}${a.relianceReduction.value}/s`}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-muted mt-6 text-center">
        Wired Layer 1–2 metrics compute live from your sessions; the rest activate as more of the measurement
        layer is built. Nothing shows a number it can&apos;t trace to your real sessions.
      </p>
    </div>
  );
}
