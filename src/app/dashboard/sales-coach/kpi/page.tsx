"use client";

import { TrendingDown, TrendingUp, Target, MessageSquareText, Gauge, Sparkles, Info } from "lucide-react";

/**
 * /dashboard/sales-coach/kpi — KPI Analytics (SalesCoach-KPI-System.md).
 *
 * Phase 0 surface: the honest FRAMEWORK + status, NOT a dashboard of computed numbers. Per the spec's
 * design principles + the constitution's honesty rule, the KPI system has no day-one behavior — scores are
 * derived from the agent's own accumulated sessions, and "insufficient data" is a valid, visible state.
 * This page frames what will be measured (the four layers) and leads with the self-baseline philosophy, so
 * the surface is real and honest while the derivation layer (baselines/snapshots/growth) is built under the
 * spec's propose-then-confirm process. No fabricated metrics appear here.
 *
 * The four layers below mirror the spec exactly; the data model that powers them REUSES the existing
 * coaching_sessions / coaching_transcript_segments / coaching_cues / coaching_cue_outcomes / after_pitch_
 * summaries tables and ADDS a computed layer (agent_baseline, kpi_snapshot, growth_record) — proposed for
 * confirmation before implementation, so nothing here asserts a number it can't yet trace to source.
 */

type Metric = { name: string; note: string; headline?: boolean };
type Layer = {
  key: string;
  title: string;
  subtitle: string;
  icon: typeof Target;
  metrics: Metric[];
};

const LAYERS: Layer[] = [
  {
    key: "outcomes",
    title: "Layer 1 · Sales outcomes",
    subtitle: "Results — the objective bottom line.",
    icon: Target,
    metrics: [
      { name: "Conversion rate", note: "closed-won ÷ opportunities" },
      { name: "Close rate", note: "won ÷ presented" },
      { name: "Average deal size", note: "revenue ÷ deals won" },
      { name: "Sales cycle length", note: "avg close − first contact" },
      { name: "Win/loss ratio", note: "won ÷ lost" },
      { name: "Quota attainment", note: "actual ÷ target" },
    ],
  },
  {
    key: "activity",
    title: "Layer 2 · Activity",
    subtitle: "Leading indicators — the effort behind the results.",
    icon: Gauge,
    metrics: [
      { name: "Sessions per day", note: "your call volume" },
      { name: "Talk-to-listen ratio", note: "your talk ÷ customer talk" },
      { name: "Objections per session", note: "and how many you resolve" },
      { name: "Follow-up rate", note: "prospects re-contacted" },
      { name: "Lead response time", note: "speed to first contact" },
    ],
  },
  {
    key: "quality",
    title: "Layer 3 · Conversation quality",
    subtitle: "The how — scored 0–100 from the transcript, with cited evidence.",
    icon: MessageSquareText,
    metrics: [
      { name: "Discovery quality", note: "did you learn before you pitched?" },
      { name: "Rapport", note: "early connection signals" },
      { name: "Objection handling", note: "how you met resistance" },
      { name: "Closing technique", note: "was the ask made, and when?" },
      { name: "Methodology adherence", note: "alignment to your framework" },
      { name: "Sentiment trajectory", note: "customer start vs. end" },
    ],
  },
  {
    key: "growth",
    title: "Layer 4 · Coaching & growth",
    subtitle: "The differentiator — is the coaching actually working?",
    icon: Sparkles,
    metrics: [
      { name: "Reliance reduction", note: "fewer cues needed while performance holds — the proof coaching worked", headline: true },
      { name: "Cue-to-outcome correlation", note: "did acting on a cue improve the result? (not mere agreement)" },
      { name: "Skill progression", note: "Δ in your quality scores vs. your own baseline" },
      { name: "Recommendation uptake", note: "did last session's advice show up this session?" },
      { name: "Time to competency", note: "days to sustained target performance" },
      { name: "Consistency", note: "how steady you are, session to session" },
    ],
  },
];

export default function KpiAnalyticsPage() {
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

      {/* The philosophy that governs every KPI here — stated up front, honestly. */}
      <section className="rounded-2xl border border-ember-400/25 bg-ember-400/[0.05] p-4 mb-5">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <div className="text-xs text-secondary leading-relaxed space-y-1.5">
            <p>
              <strong className="text-primary">These numbers are yours.</strong> Every KPI is measured
              against <em>your own</em> baseline and trajectory — how you&apos;re doing versus how you were
              doing, not versus your teammates.
            </p>
            <p>
              <strong className="text-primary">They build from your sessions.</strong> The system has no
              day-one verdict — that would be a guess. Scores activate once you&apos;ve logged enough real
              sessions to compare honestly. Until then, a metric reads{" "}
              <span className="font-mono text-muted">building…</span> — not a fake number.
            </p>
            <p>
              <strong className="text-primary">Every score is traceable.</strong> A quality or coaching
              score will always cite the sessions — and the transcript moments — that produced it.
            </p>
          </div>
        </div>
      </section>

      {/* Headline metric — Reliance reduction, featured per the spec. */}
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-emerald-400" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">Reliance reduction</h2>
          <span className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-mono">headline</span>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          The single most important measure: if you need <em>fewer</em> live cues over time while your
          performance holds or rises, the coaching worked — you&apos;re internalizing the skill, not renting
          it. This is the one metric no tool without a live AI coach can measure.
        </p>
        <p className="text-[11px] text-muted mt-2 font-mono">
          building… — activates once you have a cue-frequency trend across enough sessions.
        </p>
      </section>

      {/* The four layers — what will be measured, honestly labelled as not-yet-computed. */}
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
                {layer.metrics.map((m) => (
                  <li key={m.name} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className={`block text-xs ${m.headline ? "font-semibold text-emerald-300" : "font-medium text-primary"}`}>
                        {m.name}
                      </span>
                      <span className="block text-[11px] text-muted leading-snug">{m.note}</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5">building…</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-muted mt-6 text-center">
        The measurement layer is being built session-by-session. Nothing here shows a number it can&apos;t
        yet trace to your real sessions.
      </p>
    </div>
  );
}
