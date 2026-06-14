"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Hourglass,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { phaseLabel, type CompanyCyclePhase } from "@/lib/cycle/phase";

/**
 * /dashboard/admin/coach-readout
 *
 * The §4 readout for the Conversational Coach v1. Closes the loop the
 * Coach was shipped against — see asset A2 ("design backwards from
 * the §4 readout, not forward from features").
 *
 * Discipline this page enforces (asset A3, anti-game-your-own-eval):
 *
 *   - No "Coach is working!" verdict. The reader interprets. The
 *     page deliberately presents raw counts, side-by-side, with an
 *     explicit caveat that N is small until the data crosses a
 *     readout-meaningful threshold.
 *   - "Acceptance rate" is presented as a leading indicator only,
 *     NOT a consequence measure. The consequence comparison is
 *     coached vs uncoached topic durability — those columns sit
 *     above the heuristic table so the eye lands there first.
 *
 * What would falsify the Coach (and thus be cause for rollback):
 *   - At N ≥ 10 coached topics, the held-resolution rate is no better
 *     than uncoached.
 *   - At N ≥ 30 offered suggestions per heuristic, the dismissed
 *     rate exceeds 60% — heuristic is mis-calibrated (per A4 the
 *     readout, not a pre-decision).
 */

type TopicStats = {
  total: number;
  closed: number;
  held: number;
  reopened: number;
  partial: number;
  unknown: number;
  avgCloseHours: number | null;
  avgMessages: number;
};

type HeuristicStats = {
  id: string;
  offered: number;
  accepted: number;
  dismissed: number;
  acceptRate: number | null;
};

type SurfaceStats = {
  surface: string;
  offered: number;
  accepted: number;
  dismissed: number;
  acceptRate: number | null;
  topHeuristic: string | null;
};

type CycleBlock = {
  phase: CompanyCyclePhase;
  daysIntoCycle: number;
  daysRemainingInPhase: number;
  skippedControl: boolean;
  skippedAt: string | null;
  skipReason: string | null;
  cycleStartedAt: string | null;
};

type TaskOutcomeStats = {
  total: number;
  completed: number;
  completionRate: number | null;
};

type SpawnBlock = {
  fromDecision: TaskOutcomeStats;
  fromChat: TaskOutcomeStats;
  direct: TaskOutcomeStats;
  total: number;
};

type GradeBlock = {
  productive: number;
  neutral: number;
  needsGuidance: number;
  total: number;
};

type AnalyzePrinciple = {
  principle: string;
  book: string | null;
  count: number;
  needsImprovementCount: number;
};

type AnalyzeBlock = {
  total: number;
  topPrinciples: AnalyzePrinciple[];
};

type Readout = {
  coached: TopicStats;
  uncoached: TopicStats;
  heuristics: HeuristicStats[];
  surfaces: SurfaceStats[];
  cycle: CycleBlock | null;
  tasksSpawn: SpawnBlock;
  grades: GradeBlock;
  analyze: AnalyzeBlock;
  generatedAt: string;
};

const SURFACE_LABEL: Record<string, string> = {
  chat_topic: "Chat topics",
  task: "Tasks",
  decision: "Decision Dialogue",
  feedback: "Feedback drafts",
  smoke_test_result: "Smoke test notes",
};

const HEURISTIC_LABEL: Record<string, { name: string; source: string }> = {
  "nvc-evaluation": {
    name: "NVC — evaluation vs observation",
    source: "Nonviolent Communication — Rosenberg",
  },
  "voss-bare-assertion": {
    name: "Voss — assertion before label",
    source: "Never Split the Difference — Voss",
  },
  "stone-identity-collision": {
    name: "Stone-Heen — identity vs behavior",
    source: "Difficult Conversations — Stone, Patton, Heen",
  },
};

// Thresholds below which we explicitly call out "N too small to compare."
// Picked deliberately small so the readout becomes meaningful within a
// realistic walk-the-Coach window (60 days from §4 readout language),
// not arbitrarily strict.
const COACHED_TOPIC_THRESHOLD = 10;
const HEURISTIC_OFFERED_THRESHOLD = 30;

function fmtPct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function fmtHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default function CoachReadoutPage() {
  const [data, setData] = useState<Readout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/coach-readout");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as Readout;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enoughCoached =
    (data?.coached.total ?? 0) >= COACHED_TOPIC_THRESHOLD;

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Coach readout"
        subtitle="§4 instrument · raw counts, no verdicts — the reader interprets"
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Discipline preamble — explicit so the reader knows what
            this surface IS and IS NOT. */}
        <div className="glass-card p-4 border border-[#FACC15]/30 bg-[#FACC15]/5">
          <p className="text-xs text-secondary leading-relaxed">
            This page surfaces what the chain says about whether the
            Conversational Coach changes downstream consequence — NOT
            whether testers agree with the Coach&apos;s suggestions.
            That distinction is the difference between measuring
            agreement and measuring consequence (§3.5). It deliberately
            does not present a verdict. The reader interprets.
          </p>
          <p className="text-[11px] text-muted leading-relaxed mt-2">
            <span className="font-semibold text-brand">Coach v2 — mirror frame:</span>{" "}
            chips no longer assert a verdict on a single draft. They
            surface a per-user pattern count drawn from the §3.1 record
            (past <code className="font-mono">coach.pattern_observed</code>{" "}
            events) and ask a question. The user renders the verdict; the
            System only reports a count. Asset A11 in the Library.
          </p>
          <p className="text-[11px] text-muted leading-relaxed mt-2">
            What would falsify the Coach: at N ≥ {COACHED_TOPIC_THRESHOLD}{" "}
            coached topics, the held-resolution rate is no better than
            uncoached. Or at N ≥ {HEURISTIC_OFFERED_THRESHOLD} offered
            per heuristic, the dismiss rate exceeds 60%.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading readout…
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {data && (
          <>
            {/* §3.4 cycle context — frames every metric below. The reader
                interprets a coach-on metric differently in 'intervention'
                (legitimate single-variable comparison) than in 'ongoing'
                (post-checkpoint, compounding). Skipped-control flags the
                company as one whose Month 1 was NOT a clean baseline. */}
            {data.cycle && (
              <div
                className={`glass-card p-4 border ${
                  data.cycle.phase === "control"
                    ? "border-arc-400/40 bg-arc-400/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Hourglass
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      data.cycle.phase === "control"
                        ? "text-arc-300"
                        : "text-emerald-300"
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold ${
                        data.cycle.phase === "control"
                          ? "text-arc-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {phaseLabel(data.cycle.phase)}
                      {data.cycle.skippedControl && (
                        <span className="ml-2 text-[10px] text-accent-text uppercase tracking-widest">
                          · skipped control
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-secondary leading-relaxed">
                      Day {data.cycle.daysIntoCycle} from anchor.{" "}
                      {data.cycle.phase === "control"
                        ? `Coach is locked OFF for ${data.cycle.daysRemainingInPhase} more day${data.cycle.daysRemainingInPhase === 1 ? "" : "s"}. Every Coach-on metric below should be zero — if it isn't, the §3.4 trigger has a hole.`
                        : data.cycle.phase === "intervention"
                          ? `Single-variable intervention window — Coach activity below is attributable to the method. ${data.cycle.daysRemainingInPhase} day${data.cycle.daysRemainingInPhase === 1 ? "" : "s"} until the proof checkpoint; data continues to accumulate after.`
                          : "Post-checkpoint compounding period. Trends below are read against the intervention-window slope, not against zero."}
                    </p>
                    {data.cycle.skippedControl && data.cycle.skipReason && (
                      <p className="mt-2 text-[10px] text-secondary leading-relaxed italic">
                        <span className="text-accent-text font-semibold">
                          Skip reason on record:
                        </span>{" "}
                        “{data.cycle.skipReason}”
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* N-too-small caveat */}
            {!enoughCoached && (
              <div className="glass-card p-3 border border-gold-400/40 bg-gold-400/5 flex items-start gap-2">
                <TriangleAlert
                  className="w-4 h-4 text-accent-text flex-shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-xs text-secondary leading-relaxed">
                  <span className="font-semibold text-accent-text">
                    N too small for an honest comparison.
                  </span>{" "}
                  We have <span className="font-mono">{data.coached.total}</span>{" "}
                  coached topics; the comparison becomes meaningful at{" "}
                  <span className="font-mono">{COACHED_TOPIC_THRESHOLD}</span>.
                  The numbers below are visible for transparency, but
                  drawing a conclusion this early would be the imitation-of-
                  intelligence trap §5 explicitly warns against.
                </p>
              </div>
            )}

            {/* Topic outcomes side-by-side */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Topic outcomes — coached vs uncoached
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Consequence measure (§3.5). Topics where{" "}
                <span className="font-mono">coach_enabled</span> was true
                during the conversation vs topics where it was false. We
                read the durability column FIRST — that&apos;s the
                §3.5-anchored outcome — then time-to-close and average
                message count as efficiency signals.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                      <th className="py-2 pr-4">Metric</th>
                      <th className="py-2 pr-4">Coach OFF</th>
                      <th className="py-2 pr-4">Coach ON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    <Row
                      label="Total topics"
                      left={`${data.uncoached.total}`}
                      right={`${data.coached.total}`}
                    />
                    <Row
                      label="Closed"
                      left={`${data.uncoached.closed} (${fmtPct(data.uncoached.closed, data.uncoached.total)})`}
                      right={`${data.coached.closed} (${fmtPct(data.coached.closed, data.coached.total)})`}
                    />
                    <Row
                      label="Held"
                      left={`${data.uncoached.held} (${fmtPct(data.uncoached.held, data.uncoached.closed)} of closed)`}
                      right={`${data.coached.held} (${fmtPct(data.coached.held, data.coached.closed)} of closed)`}
                      emphasize
                    />
                    <Row
                      label="Reopened"
                      left={`${data.uncoached.reopened}`}
                      right={`${data.coached.reopened}`}
                    />
                    <Row
                      label="Partial"
                      left={`${data.uncoached.partial}`}
                      right={`${data.coached.partial}`}
                    />
                    <Row
                      label="Unknown / unreviewed"
                      left={`${data.uncoached.unknown}`}
                      right={`${data.coached.unknown}`}
                    />
                    <Row
                      label="Avg time to close"
                      left={fmtHours(data.uncoached.avgCloseHours)}
                      right={fmtHours(data.coached.avgCloseHours)}
                    />
                    <Row
                      label="Avg messages per topic"
                      left={data.uncoached.avgMessages.toFixed(1)}
                      right={data.coached.avgMessages.toFixed(1)}
                    />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Task Spawn lineage — closes §1.6 on the measurement side.
                Are tasks spawned from structured sources (decisions, chats)
                completing more reliably than direct-created tasks? This
                is the MECHANISM check — better diagnosis upstream produces
                better action downstream. */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Task Spawn lineage — does structured upstream produce
                  better action?
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Tasks split by their source: spawned from a finalized
                Decision Dialogue, spawned from a chat message selection,
                or created directly. The §1.6 mechanism claim is that
                structured upstream produces more reliable downstream —
                this table is the honest test. Low N still surfaces;
                interpret with the same caution as above.
              </p>
              {data.tasksSpawn.total === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No tasks recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                        <th className="py-2 pr-4">Source</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-4">Completed</th>
                        <th className="py-2 pr-4">Completion rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      <SpawnRow
                        label="From Decision Dialogue"
                        s={data.tasksSpawn.fromDecision}
                      />
                      <SpawnRow
                        label="From chat messages"
                        s={data.tasksSpawn.fromChat}
                      />
                      <SpawnRow
                        label="Direct-created"
                        s={data.tasksSpawn.direct}
                      />
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Coach v5 — communication baseline (grade mix). The §3.5
                differentiated metric: BETTER communication is the
                MECHANISM. Productive grade = a message that read as
                clear, productive, well-suited; needs-guidance = a
                message that read as evaluation/identity/unproductive.
                Trend over time is what matters, not the snapshot. */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Communication baseline (last 30 days)
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                §3.5 anchors the differentiated metric to{" "}
                <em>downstream consequence</em>, not adoption. This row
                reads the Encouragement System grade on every sent
                message: productive (clear + suited to context),
                neutral (no signal), needs-guidance (likely defensive-
                shutdown / evaluation-as-fact / identity-attack). A
                Coach that&apos;s working should bend the mix toward
                productive AND drop needs-guidance over the cycle.
              </p>
              {data.grades.total === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No graded messages in the last 30 days. The grader
                  fires on sent messages; either the chain hasn&apos;t
                  accumulated enough data yet, or the cycle is still in
                  control.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <GradeStat
                    label="Productive"
                    count={data.grades.productive}
                    total={data.grades.total}
                    tone="emerald"
                  />
                  <GradeStat
                    label="Neutral"
                    count={data.grades.neutral}
                    total={data.grades.total}
                    tone="muted"
                  />
                  <GradeStat
                    label="Needs guidance"
                    count={data.grades.needsGuidance}
                    total={data.grades.total}
                    tone="amber"
                  />
                </div>
              )}
              <p className="mt-3 text-[10px] text-muted">
                n = {data.grades.total} graded messages (withheld grades
                excluded — those are grader-unavailable, not a real
                signal).
              </p>
            </div>

            {/* Coach v5 analyze patterns — what the Coach has been
                TEACHING, not what users accepted. Different question
                than acceptance rate: are we naming the same principles
                over and over (in which case the team isn't internalizing
                them), or is the spread widening (in which case the
                Coach is teaching across the surface area). */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Top principles cited (last 30 days)
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                What the Coach has been NAMING when it surfaces. Heavily
                concentrated on one principle = the team has a recurring
                pattern there; the Coach should be varying its framing,
                not repeating the lesson (see cross-conversation memory).
                Spread across many principles = the Coach is teaching
                breadth.
              </p>
              {data.analyze.total === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No analyze events recorded yet. coach.analyze_returned
                  is emitted from this commit forward, so this section
                  populates as the team uses Coach.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                        <th className="py-2 pr-4">Principle</th>
                        <th className="py-2 pr-4">Book</th>
                        <th className="py-2 pr-4">Cited</th>
                        <th className="py-2 pr-4">Of which: needs-improvement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {data.analyze.topPrinciples.map((p) => (
                        <tr key={p.principle}>
                          <td className="py-2 pr-4 text-primary">
                            {p.principle}
                          </td>
                          <td className="py-2 pr-4 text-secondary">
                            {p.book ?? "—"}
                          </td>
                          <td className="py-2 pr-4 font-mono text-primary">
                            {p.count}
                          </td>
                          <td className="py-2 pr-4 font-mono text-secondary">
                            {p.needsImprovementCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-[10px] text-muted">
                n = {data.analyze.total} analyze calls in window.
              </p>
            </div>

            {/* Per-surface — Coach reach across communication surfaces */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  By surface — where the Coach is firing
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Coach v1.1 runs on chat topics, tasks, feedback drafts,
                smoke-test notes (and Decision Dialogue once that mount
                lands). Per-surface acceptance shows where the heuristics
                land vs where they read as noise — input to surface-
                specific calibration, NOT a consequence measure for the
                Coach as a whole.
              </p>
              {data.surfaces.length === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No Coach activity on any surface yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                        <th className="py-2 pr-4">Surface</th>
                        <th className="py-2 pr-4">Offered</th>
                        <th className="py-2 pr-4">Accepted</th>
                        <th className="py-2 pr-4">Dismissed</th>
                        <th className="py-2 pr-4">Accept rate</th>
                        <th className="py-2 pr-4">Top heuristic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {data.surfaces.map((s) => (
                        <tr key={s.surface}>
                          <td className="py-2 pr-4 text-primary">
                            {SURFACE_LABEL[s.surface] ?? s.surface}
                          </td>
                          <td className="py-2 pr-4 font-mono">{s.offered}</td>
                          <td className="py-2 pr-4 font-mono">{s.accepted}</td>
                          <td className="py-2 pr-4 font-mono">{s.dismissed}</td>
                          <td className="py-2 pr-4 font-mono">
                            {s.acceptRate == null
                              ? "—"
                              : `${Math.round(s.acceptRate * 100)}%`}
                          </td>
                          <td className="py-2 pr-4 text-[10px] text-muted font-mono">
                            {s.topHeuristic
                              ? (HEURISTIC_LABEL[s.topHeuristic]?.name ?? s.topHeuristic)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Per-heuristic acceptance */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Per-heuristic — calibration signals
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                Leading indicator (NOT consequence). High dismiss rate at
                N ≥ {HEURISTIC_OFFERED_THRESHOLD} = heuristic is over-firing
                on phrasing testers don&apos;t consider a problem. That&apos;s
                input to a calibration PR, not a Coach verdict — the
                consequence comparison above is what answers the §4
                question of whether the Coach earns its keep.
              </p>
              {data.heuristics.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">
                  No coach.suggestion_* events on the chain yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted border-b border-default">
                        <th className="py-2 pr-4">Heuristic</th>
                        <th className="py-2 pr-4">Offered</th>
                        <th className="py-2 pr-4">Accepted</th>
                        <th className="py-2 pr-4">Dismissed</th>
                        <th className="py-2 pr-4">Accept rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {data.heuristics.map((h) => {
                        const label = HEURISTIC_LABEL[h.id];
                        const enoughOffered =
                          h.offered >= HEURISTIC_OFFERED_THRESHOLD;
                        return (
                          <tr key={h.id}>
                            <td className="py-2 pr-4">
                              <p className="text-primary">
                                {label?.name ?? h.id}
                              </p>
                              {label && (
                                <p className="text-[10px] text-muted font-mono">
                                  {label.source}
                                </p>
                              )}
                            </td>
                            <td className="py-2 pr-4 font-mono">{h.offered}</td>
                            <td className="py-2 pr-4 font-mono">{h.accepted}</td>
                            <td className="py-2 pr-4 font-mono">{h.dismissed}</td>
                            <td className="py-2 pr-4 font-mono">
                              {h.acceptRate == null
                                ? "—"
                                : enoughOffered
                                  ? `${Math.round(h.acceptRate * 100)}%`
                                  : `${Math.round(h.acceptRate * 100)}% (low N)`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted text-center font-mono">
              generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  left,
  right,
  emphasize,
}: {
  label: string;
  left: string;
  right: string;
  emphasize?: boolean;
}) {
  return (
    <tr className={emphasize ? "bg-emerald-500/5" : ""}>
      <td className="py-2 pr-4 text-secondary">{label}</td>
      <td className="py-2 pr-4 font-mono text-primary">{left}</td>
      <td className="py-2 pr-4 font-mono text-primary">{right}</td>
    </tr>
  );
}

function SpawnRow({
  label,
  s,
}: {
  label: string;
  s: TaskOutcomeStats;
}) {
  return (
    <tr>
      <td className="py-2 pr-4 text-secondary">{label}</td>
      <td className="py-2 pr-4 font-mono text-primary">{s.total}</td>
      <td className="py-2 pr-4 font-mono text-primary">{s.completed}</td>
      <td className="py-2 pr-4 font-mono text-primary">
        {s.completionRate == null
          ? "—"
          : `${Math.round(s.completionRate * 100)}%`}
      </td>
    </tr>
  );
}

function GradeStat({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "emerald" | "muted" | "amber";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "amber"
        ? "border-accent-text/30 bg-accent-text/5 text-accent-text"
        : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-primary">{pct}%</p>
      <p className="text-[10px] text-muted font-mono">
        {count} of {total}
      </p>
    </div>
  );
}
