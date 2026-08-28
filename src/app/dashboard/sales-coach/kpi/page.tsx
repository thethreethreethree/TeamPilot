"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, Target, MessageSquareText, Gauge, Sparkles, Info, Loader2, ChevronRight, Users, Download } from "lucide-react";
import { toCsv } from "@/lib/export/toCsv";

/**
 * /dashboard/sales-coach/kpi — KPI Analytics (SalesCoach-KPI-System.md).
 *
 * Renders the caller's OWN KPIs, computed on-read via /api/coach/kpi/me. A wired metric shows a real value once
 * past the Understanding Gate (>= 5 sessions) — otherwise an honest "building". A metric that is NOT computable
 * from data we capture today (Sales cycle, Follow-up rate — both need prospect-identity tracking across visits)
 * is marked `blocked` and renders "needs prospect tracking", NOT "building", so the surface never implies a
 * number is coming that isn't (§3.4). Self-baseline framing throughout; Reliance Reduction featured.
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
  firstSessionAt?: string | null;
  establishingBaseline?: boolean;
  conversionRate: MetricResult;
  relianceReduction: MetricResult;
  quotaAttainment?: MetricResult;
  objectionsPerSession?: MetricResult;
  objectionResolutionRate?: MetricResult;
  recommendationUptake?: MetricResult;
  slipping?: boolean;
  slippingReasons?: string[];
};

/** Whole days since an ISO timestamp — rep tenure for the new-hire ramp context (never negative). */
function daysSince(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : 0;
}

type Fmt = "pct" | "money" | "num" | "min" | "days" | "score" | "slope" | "delta" | "corr";
// `blocked` = this metric is NOT computable from data we capture today (it needs a capability we don't have yet,
// e.g. linking the same prospect across visits). It renders an honest "needs …" state, NOT "building…" — because
// "building" implies the number is on its way once enough sessions land, and for a blocked metric it never is
// (§3.4: an honest not-available, never a false "coming soon").
type Metric = { name: string; note: string; apiKey?: string; fmt?: Fmt; headline?: boolean; blocked?: string };
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
      { name: "Win/loss ratio", note: "wins per loss — builds until you have a loss to compare", apiKey: "winLossRatio", fmt: "num" },
      { name: "Average deal size", note: "revenue ÷ deals won", apiKey: "avgDealSize", fmt: "money" },
      { name: "Total revenue", note: "sum of won deal values", apiKey: "revenue", fmt: "money" },
      { name: "Sales cycle length", note: "avg days from first contact to sale, by prospect", apiKey: "salesCycleLength", fmt: "days" },
      { name: "Quota attainment", note: "deals won this month ÷ your monthly target", apiKey: "quotaAttainment", fmt: "pct" },
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
      { name: "Objections per session", note: "how much resistance you meet, per call", apiKey: "objectionsPerSession", fmt: "num" },
      { name: "Objections resolved", note: "of objections raised, the share you met without a breakdown", apiKey: "objectionResolutionRate", fmt: "pct" },
      { name: "Follow-up rate", note: "share of your prospects you re-contacted (by name)", apiKey: "followUpRate", fmt: "pct" },
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
      { name: "Recommendation uptake", note: "did last session's focus improve the next session?", apiKey: "recommendationUptake", fmt: "pct" },
      { name: "Consistency", note: "how steady your quality is, call to call", apiKey: "consistency", fmt: "score" },
    ],
  },
];

function fmtValue(v: number, fmt?: Fmt): string {
  if (fmt === "pct") return `${v}%`;
  if (fmt === "money") return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (fmt === "min") return `${v} min`;
  if (fmt === "days") return v === 1 ? "1 day" : `${v} days`;
  if (fmt === "score") return `${v} / 100`;
  if (fmt === "slope") return `${v > 0 ? "+" : ""}${v}/session`;
  if (fmt === "delta") return v === 0 ? "0" : `${v > 0 ? "▲ +" : "▼ "}${Math.abs(v)}`;
  if (fmt === "corr") return `r=${v > 0 ? "+" : ""}${v}`;
  return v.toLocaleString();
}

export default function KpiAnalyticsPage() {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinguish a FETCH FAILURE from a genuine "no data yet". Without this the page swallowed every
  // error and left `data` null, so a veteran rep with hundreds of sessions saw every KPI as
  // "building…" — an error disguised as insufficient-data, the exact dishonesty the product's
  // honesty thesis forbids (the page's own copy promises "an honest insufficient-data, never a
  // guessed number").
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamAgent[] | null>(null);
  const [alertDropPct, setAlertDropPct] = useState(15);
  const [teamQuotaTarget, setTeamQuotaTarget] = useState<number | null>(null);
  // Ranking is AVAILABLE but never the default frame (spec non-negotiable): default sorts by name.
  const [teamSort, setTeamSort] = useState<"name" | "conversion" | "reliance">("name");

  // Extracted so the error banner's "Try again" can re-run it in place (no full page reload).
  const loadMe = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/coach/kpi/me");
      if (res.ok) setData(await res.json());
      else setLoadError(true); // 401/500/etc — an error, NOT "no data yet"
    } catch {
      setLoadError(true); // network — an error, NOT "no data yet"
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    let alive = true;
    // Manager rollup — 403 for non-managers (we just hide the section then).
    (async () => {
      try {
        const res = await fetch("/api/coach/kpi/team");
        if (res.ok && alive) {
          const j = (await res.json()) as {
            agents: TeamAgent[];
            alertDropPct?: number;
            monthlyQuotaTarget?: number | null;
          };
          if (typeof j.alertDropPct === "number") setAlertDropPct(j.alertDropPct);
          if (typeof j.monthlyQuotaTarget === "number") setTeamQuotaTarget(j.monthlyQuotaTarget);
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
          // A blocked metric exports its honest reason, not "building" (which would imply it's on its way).
          Value: m.blocked ? m.blocked : r && r.value !== null ? r.value : "building",
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

  // Team CSV (manager view) — the per-rep rollup the manager is looking at. Same formula-safe writer. Growth
  // columns only (no fabricated ranking); "building" where a metric is gated. Quota column only when set.
  const exportTeamCsv = () => {
    if (!team) return;
    const cols = [
      "Rep",
      "Sessions",
      "Conversion %",
      "Reliance /s",
      "Quota %",
      "Objections /call",
      "Objections resolved %",
      "Recommendation uptake %",
      "Check-in",
    ];
    const rows = team.map((a) => ({
      Rep: a.name || "Agent",
      Sessions: a.sessionCount,
      "Conversion %": a.conversionRate.value ?? "building",
      "Reliance /s": a.relianceReduction.value ?? "building",
      "Quota %": teamQuotaTarget == null ? "" : (a.quotaAttainment?.value ?? "building"),
      "Objections /call": a.objectionsPerSession?.value ?? "building",
      "Objections resolved %": a.objectionResolutionRate?.value ?? "building",
      "Recommendation uptake %": a.recommendationUptake?.value ?? "building",
      "Check-in": a.slipping ? (a.slippingReasons?.join(" + ") || "yes") : "",
    }));
    const csv = toCsv(rows, cols);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kpi-team.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMetricValue = (m: Metric) => {
    // A blocked metric is honestly "not available yet" (needs a capability we don't capture), never "building…".
    if (m.blocked)
      return (
        <span className="text-[10px] font-mono text-muted/60 italic shrink-0 mt-0.5" title={`Not computable yet — ${m.blocked}.`}>
          {m.blocked}
        </span>
      );
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

      {loadError && !data && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 mb-5">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden />
            <div className="text-xs text-secondary leading-relaxed">
              <p>
                <strong className="text-primary">Couldn&apos;t load your KPIs.</strong> This is a
                temporary error, not a reset — your sessions are safe. Any metrics below reading{" "}
                <span className="font-mono text-muted">building…</span> are showing that only because
                the load failed, not because the data is missing.
              </p>
              <button
                type="button"
                onClick={() => void loadMe()}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary border border-default hover:border-strong rounded-md px-2.5 py-1.5 transition-colors"
              >
                <Loader2 className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
                Try again
              </button>
            </div>
          </div>
        </section>
      )}

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
        // Name WHICH areas moved (spec principle 5: surface the contributing factors, not just a number).
        const NAMES: Record<string, string> = {
          conversionRate: "Conversion",
          closeRate: "Close rate",
          avgDealSize: "Avg deal size",
          sessionsPerDay: "Sessions/day",
        };
        const improved: string[] = [];
        const declined: string[] = [];
        for (const [k, label] of Object.entries(NAMES)) {
          const d = data?.deltas?.[k];
          if (typeof d === "number") {
            if (d > 0) improved.push(label);
            else if (d < 0) declined.push(label);
          }
        }
        const skill = data?.metrics?.skillProgression?.value ?? null;
        if (typeof skill === "number") {
          if (skill > 0) improved.push("Overall quality");
          else if (skill < 0) declined.push("Overall quality");
        }
        if (improved.length + declined.length === 0) return null;
        return (
          <section className="rounded-2xl border border-default bg-white/[0.02] p-4 mb-5">
            <p className="text-sm leading-relaxed">
              {improved.length > 0 && (
                <span className="text-emerald-300">
                  <span className="font-semibold">Since your earlier calls, you&apos;re up in</span>{" "}
                  {improved.join(", ")}.
                </span>
              )}
              {declined.length > 0 && (
                <span className="text-secondary">
                  {improved.length > 0 ? " " : ""}
                  Focus next on {declined.join(", ")}.
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
            <button
              type="button"
              onClick={exportTeamCsv}
              className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted hover:text-secondary border border-default rounded px-2 py-0.5 transition-colors"
              title="Export the team rollup as CSV"
            >
              <Download className="w-3 h-3" aria-hidden /> CSV
            </button>
          </div>
          {/* Exception alerts (founder-set threshold): reps whose recent conversion has slipped ≥N% below
              their own baseline. A "check in" prompt, not a callout — framed as coaching, not ranking. */}
          {(() => {
            const slipping = team.filter((a) => a.slipping);
            if (slipping.length === 0) return null;
            return (
              <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />
                  <span>
                    <strong>{slipping.length}</strong> rep{slipping.length === 1 ? "" : "s"} slipped ≥
                    {alertDropPct}% below their own recent baseline (conversion or pitch quality) —{" "}
                    {slipping
                      .map((a) => {
                        const why = a.slippingReasons?.length ? ` (${a.slippingReasons.join(" + ")})` : "";
                        return `${a.name || "Agent"}${why}`;
                      })
                      .join(", ")}
                    . Worth a check-in; this reads their trend, not a leaderboard.
                  </span>
                </p>
              </div>
            );
          })()}
          {/* Team-level reliance-reduction summary (spec: manager view). */}
          {(() => {
            const withR = team.filter((a) => a.relianceReduction.value !== null);
            if (withR.length === 0) return null;
            const improving = withR.filter((a) => (a.relianceReduction.value ?? 0) < 0).length;
            return (
              <p className="text-[11px] text-emerald-300/90 mb-1.5">
                Reliance: <strong>{improving}</strong> of {withR.length} rep{withR.length === 1 ? "" : "s"}{" "}
                needing fewer cues over time — the clearest sign the coaching is landing.
              </p>
            );
          })()}
          <p className="text-[11px] text-muted mb-2">
            Per-agent growth, each measured against their own past. Ranking is optional — the default is by
            name, not a leaderboard.
          </p>
          {teamQuotaTarget != null && (
            <p className="text-[11px] text-secondary mb-2">
              Monthly quota: <strong>{teamQuotaTarget}</strong> deal{teamQuotaTarget === 1 ? "" : "s"} per rep.
              Attainment below is deals won this month ÷ target.
            </p>
          )}
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
                    <span className="flex items-center gap-1.5 text-xs font-medium text-primary truncate">
                      {a.name || "Agent"}
                      {a.slipping && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-300"
                          title={`Recent ${
                            a.slippingReasons?.join(" and ") || "performance"
                          } is ≥${alertDropPct}% below this rep's own baseline — worth a check-in.`}
                        >
                          <TrendingDown className="w-2.5 h-2.5" aria-hidden /> check-in
                        </span>
                      )}
                      {a.establishingBaseline && (
                        <span
                          className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-400/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300"
                          title="Still building enough history for trend comparison and slip alerts — read these numbers as a starting point, not underperformance."
                        >
                          new
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {a.sessionCount} sessions
                      {a.firstSessionAt ? ` · ${daysSince(a.firstSessionAt)}d` : ""}
                    </span>
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
                    {teamQuotaTarget != null && (
                      <span>
                        <span className="block text-[9px] uppercase tracking-widest text-muted">Quota</span>
                        <span className="block text-xs font-semibold text-primary tabular-nums">
                          {a.quotaAttainment?.value == null ? "building…" : `${a.quotaAttainment.value}%`}
                        </span>
                      </span>
                    )}
                    <span
                      title={
                        a.objectionResolutionRate?.value == null
                          ? undefined
                          : `${a.objectionResolutionRate.value}% of objections met without a breakdown`
                      }
                    >
                      <span className="block text-[9px] uppercase tracking-widest text-muted">Objections</span>
                      <span className="block text-xs font-semibold text-primary tabular-nums">
                        {a.objectionsPerSession?.value == null ? "building…" : `${a.objectionsPerSession.value}/call`}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted">Uptake</span>
                      <span className="block text-xs font-semibold text-primary tabular-nums">
                        {a.recommendationUptake?.value == null ? "building…" : `${a.recommendationUptake.value}%`}
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
