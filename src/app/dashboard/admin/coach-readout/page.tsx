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
import { LearningHint } from "@/components/learning/LearningHint";

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

type StepsBlock = {
  completed: number;
  reopened: number;
  net: number;
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
  tasksSteps30d: StepsBlock;
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
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        {/* Discipline preamble — explicit so the reader knows what
            this surface IS and IS NOT. */}
        <LearningHint
          as="block"
          category="Coach Readout · Discipline"
          title="What this readout is and isn't"
          whatItIs="The framing contract for the whole page: this surface measures whether the Coach changes downstream consequence, not whether testers agreed with its suggestions — and it deliberately presents no verdict."
          why="Measuring agreement instead of consequence is grading your own homework (§3.5). The preamble also states, up front, what would falsify the Coach — the honest test written before the data arrives, so a good-looking chart can't retroactively define success."
          how="Read this first. It tells you the durability comparison is the real answer and acceptance rate is only a leading indicator. When you read the tables below, hold them to the falsification bar stated here."
          principle="Name what would prove you wrong before you look — a metric with no falsifier is persuasion, not measurement."
        >
        <div className="glass-card p-4 border border-ember-400/30 bg-ember-400/5">
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
        </LearningHint>

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
              <LearningHint
                as="block"
                category="Coach Readout · Cycle context"
                title="Where this company is in its cycle"
                whatItIs="The phase banner: whether the company is in month-1 control (Coach off), the single-variable intervention window (Coach on), or the post-checkpoint compounding period — plus a flag if the control month was skipped."
                why="Every metric below reads differently depending on phase (§3.4). A Coach-on number during control means the trigger has a hole; the same number during intervention is attributable to the method. Without this frame you'd misread the whole page."
                how="Check the phase first. In control, expect Coach-on metrics to be zero. In intervention, treat the numbers as a clean single-variable read. If 'skipped control' shows, discount the baseline honestly — that month wasn't clean."
                principle="A measurement without its control condition isn't a result — it's a number looking for a story."
              >
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
              </LearningHint>
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
            <LearningHint
              as="block"
              category="Coach Readout · Consequence"
              title="Topic outcomes — coached vs uncoached"
              whatItIs="A side-by-side of conversation topics where the Coach was on vs off: totals, closed, held, reopened, time-to-close, and messages per topic."
              why="This is the §3.5-anchored consequence measure — the real answer to whether the Coach earns its keep. 'Held' is read first because durability, not closure speed, is the outcome that matters. Reopened is data, not shame."
              how="Read the Held row first and compare the two columns at equal N. If coached durability doesn't beat uncoached at the falsification threshold, that's the rollback signal, not a reason to reframe the metric."
              principle="Read the durability column first — a fix that reopens didn't resolve anything, however fast it closed."
            >
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
              <div className="overflow-x-auto" role="region" aria-label="Comparison table">
                <table className="w-full min-w-[480px] text-xs">
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
            </LearningHint>

            {/* Task Spawn lineage — closes §1.6 on the measurement side.
                Are tasks spawned from structured sources (decisions, chats)
                completing more reliably than direct-created tasks? This
                is the MECHANISM check — better diagnosis upstream produces
                better action downstream. */}
            <LearningHint
              as="block"
              category="Coach Readout · Mechanism"
              title="Task Spawn lineage"
              whatItIs="Completion rates for tasks split by origin: spawned from a finalized Decision Dialogue, spawned from a chat message, or created directly."
              why="This tests the §1.6 mechanism claim — that structured upstream produces more reliable downstream action. If decision-spawned tasks complete better than direct-created ones, the diagnosis-before-action discipline is showing its value in the numbers."
              how="Compare completion rates across the three sources at comparable N. A higher rate from structured sources supports the mechanism; parity or worse is a signal the upstream structure isn't yet paying off — worth investigating, not hiding."
              principle="Better diagnosis upstream should show up as better completion downstream — if it doesn't, the mechanism claim is unproven."
            >
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
                <div className="overflow-x-auto" role="region" aria-label="Data table">
                  <table className="w-full min-w-[480px] text-xs">
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
            </LearningHint>

            {/* Step completion velocity — reads the new
                task.step_completed / task.step_reopened chain
                events from migration 0032. Answers "are the
                spawned steps actually getting done?" Both counts
                shown side-by-side per §A11 — a reopened step is
                data, not a verdict (sometimes the diagnosis was
                wrong and the reopen is correct). */}
            <LearningHint
              as="block"
              category="Coach Readout · Execution"
              title="Step completion velocity"
              whatItIs="Completed and reopened step counts over the last 30 days, plus net momentum (completed minus reopened)."
              why="It answers whether spawned plans actually get executed step by step. Both counts sit side-by-side because a reopen is data, not failure — sometimes the diagnosis was wrong and reopening is the correct move (§A11)."
              how="High net positive with low reopen is the momentum signal. High reopen with low net means the gate diagnoses aren't holding under contact with reality — look upstream at how steps are being scoped."
              principle="Count both completed and reopened — a reopen can be the system being honest, not the plan failing."
            >
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Step completion velocity (last 30 days)
                </h2>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mb-4">
                The §1.6-on-tasks question: are spawned plans
                actually getting executed step by step? Both
                completed and reopened counts surface together —
                reopen is data, not failure. A high net positive
                with a low reopen rate is the momentum signal;
                high reopen with low net means the gate diagnoses
                aren&apos;t holding under contact with reality.
              </p>
              {data.tasksSteps30d.completed === 0 &&
              data.tasksSteps30d.reopened === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  No step events in the last 30 days. Either no
                  tasks have spawned steps yet, or no steps have
                  been checked. The chain populates as the team uses
                  the interactive checklist.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <GradeStat
                    label="Steps completed"
                    count={data.tasksSteps30d.completed}
                    total={
                      data.tasksSteps30d.completed +
                      data.tasksSteps30d.reopened
                    }
                    tone="emerald"
                  />
                  <GradeStat
                    label="Steps reopened"
                    count={data.tasksSteps30d.reopened}
                    total={
                      data.tasksSteps30d.completed +
                      data.tasksSteps30d.reopened
                    }
                    tone="amber"
                  />
                  <div className="rounded-lg border border-default bg-surface/40 p-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-secondary">
                      Net momentum
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary">
                      {data.tasksSteps30d.net > 0 ? "+" : ""}
                      {data.tasksSteps30d.net}
                    </p>
                    <p className="text-[10px] text-muted font-mono">
                      completed − reopened
                    </p>
                  </div>
                </div>
              )}
            </div>
            </LearningHint>

            {/* Coach v5 — communication baseline (grade mix). The §3.5
                differentiated metric: BETTER communication is the
                MECHANISM. Productive grade = a message that read as
                clear, productive, well-suited; needs-guidance = a
                message that read as evaluation/identity/unproductive.
                Trend over time is what matters, not the snapshot. */}
            <LearningHint
              as="block"
              category="Coach Readout · Communication"
              title="Communication baseline"
              whatItIs="The grade mix on sent messages over 30 days: productive (clear, suited to context), neutral (no signal), and needs-guidance (likely defensive, evaluation-as-fact, or identity-attack)."
              why="Better individual communication is the §3.5 mechanism — the cause whose results are shorter meetings and faster resolution. Anchored to a grade on the message, not to whether anyone adopted the Coach's phrasing."
              how="Read the trend across the cycle, not the snapshot. A working Coach bends the mix toward productive AND drops needs-guidance over time. A one-day reading proves nothing."
              principle="Communication is the mechanism, not the scoreboard — watch the trend bend, don't grade a single day."
            >
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
            </LearningHint>

            {/* Coach v5 analyze patterns — what the Coach has been
                TEACHING, not what users accepted. Different question
                than acceptance rate: are we naming the same principles
                over and over (in which case the team isn't internalizing
                them), or is the spread widening (in which case the
                Coach is teaching across the surface area). */}
            <LearningHint
              as="block"
              category="Coach Readout · Teaching"
              title="Top principles cited"
              whatItIs="Which named principles (and their source books) the Coach has been surfacing most, with a count of how many citations flagged needs-improvement."
              why="This asks a different question than acceptance: what is the Coach teaching? Heavy concentration on one principle means the team has a recurring pattern there — and the Coach should vary its framing, not repeat the same lesson."
              how="A concentrated distribution points to a durable team pattern worth a deliberate intervention. A wide spread means the Coach is teaching breadth. Watch whether concentrated principles fade over time — that's internalization."
              principle="Naming the same lesson over and over isn't teaching — if a principle keeps recurring, vary the framing or address the root pattern."
            >
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
                <div className="overflow-x-auto" role="region" aria-label="Data table">
                  <table className="w-full min-w-[480px] text-xs">
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
            </LearningHint>

            {/* Per-surface — Coach reach across communication surfaces */}
            <LearningHint
              as="block"
              category="Coach Readout · Reach"
              title="By surface — where the Coach is firing"
              whatItIs="Per-surface acceptance: how often the Coach offered, was accepted, or dismissed across chat topics, tasks, feedback drafts, smoke-test notes, and Decision Dialogue."
              why="This shows where heuristics land vs where they read as noise. It's input to surface-specific calibration — NOT a consequence measure for the Coach as a whole. The consequence answer is the durability table above."
              how="Look for a surface with a low accept rate at meaningful N — that's where the Coach is over-firing on phrasing users don't consider a problem. Calibrate that surface rather than judging the Coach overall."
              principle="Where a suggestion lands is a calibration signal, not a verdict — tune the surface, don't indict the whole system."
            >
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
                <div className="overflow-x-auto" role="region" aria-label="Data table">
                  <table className="w-full min-w-[480px] text-xs">
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
            </LearningHint>

            {/* Per-heuristic acceptance */}
            <LearningHint
              as="block"
              category="Coach Readout · Calibration"
              title="Per-heuristic calibration signals"
              whatItIs="Offered, accepted, dismissed, and accept-rate for each individual heuristic (with its source book), flagged 'low N' until it crosses the readout threshold."
              why="A leading indicator, not a consequence measure. A high dismiss rate at sufficient N means the heuristic is over-firing on phrasing testers don't consider a problem — input to a calibration PR, not a verdict on the Coach."
              how="Ignore any row still marked low N. For rows above threshold, a dismiss rate past 60% is the falsification signal for that heuristic — recalibrate or retire it. Don't read acceptance as proof the Coach works; the durability table does that."
              principle="Acceptance is a calibration dial, not a success metric — a dismissed suggestion tunes the heuristic, it doesn't grade the Coach."
            >
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
                <div className="overflow-x-auto" role="region" aria-label="Data table">
                  <table className="w-full min-w-[480px] text-xs">
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
            </LearningHint>

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
