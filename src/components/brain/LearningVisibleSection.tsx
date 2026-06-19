"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Brain,
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * LearningVisibleSection — §3.6 surface.
 *
 * Aggregates §3.1 chain events into honest activity readouts so the
 * user can see concrete evidence the System is accumulating something
 * specific to their team. Per the constitution, "a value curve nobody
 * can see is, commercially, a flat line."
 *
 * Constitutional framing applied throughout:
 *   - Counts not verdicts (A11 mirror applied to readouts)
 *   - Comparison to prior period is signal, not judgment
 *   - Honest empty / accumulating state — low-activity companies see
 *     "not enough yet" rather than fabricated metrics
 *   - §3.5 durability is the consequence measure (held vs reopened),
 *     not acceptance or click-through
 */

type CoachHeuristicId =
  | "nvc-evaluation"
  | "voss-bare-assertion"
  | "stone-identity-collision"
  | "coach-blame-projection"
  | "coach-emotional-escalation"
  | "coach-hot-state"
  | "coach-aggressive-language";

type CoachStats = {
  patternsObserved: number;
  suggestionsOffered: number;
  suggestionsAccepted: number;
  suggestionsDismissed: number;
  byHeuristic: Partial<Record<CoachHeuristicId, number>>;
};

type LearningSummary = {
  ready: boolean;
  accumulating?: boolean;
  reason?: string;
  coach?: {
    last7Days: CoachStats;
    prior7Days: CoachStats;
    topPatterns: Array<{
      heuristicId: CoachHeuristicId;
      count: number;
      priorCount: number;
    }>;
    cumulativePatterns: number;
  };
  decisions?: {
    last28Days: {
      opened: number;
      decided: number;
      byPath: Record<string, number>;
    };
  };
  topics?: {
    last28Days: {
      opened: number;
      closed: number;
      durability: {
        held: number;
        partial: number;
        reopened: number;
        unknown: number;
        unrated: number;
      };
    };
  };
  chain?: {
    last7Days: number;
    prior7Days: number;
    totalAllTime: number;
  };
};

const HEURISTIC_LABEL: Record<CoachHeuristicId, string> = {
  "nvc-evaluation": "Evaluation language (vs observation)",
  "voss-bare-assertion": "Assertion before label",
  "stone-identity-collision": "Critique of person, not behavior",
  "coach-blame-projection": "Locating cause in someone else",
  "coach-emotional-escalation": "Heightened emotional language",
  "coach-hot-state": "Composing from a hot state",
  "coach-aggressive-language": "Direct aggression toward a person",
};

export function LearningVisibleSection() {
  const [data, setData] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/brain/learning-summary");
        if (!res.ok) return;
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-5 flex items-center gap-2 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Reading the chain…
      </div>
    );
  }

  if (!data || !data.ready) {
    return (
      <div className="glass-card p-5">
        <p className="text-sm text-primary mb-1">Learning surface unavailable</p>
        <p className="text-xs text-muted">{data?.reason ?? "Live mode required."}</p>
      </div>
    );
  }

  if (data.accumulating) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">
            Accumulating — not enough activity to surface yet
          </h2>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          The §3.1 chain has fewer than 30 events for this company so far. Per
          §3.4 the System refuses to fabricate signal from a corpus this small.
          Once chat traffic, decisions, and tasks accumulate, this section will
          start showing what the System has noticed — pattern counts, decision
          durability, topic resolutions, growth vs prior week. No instant
          results; that&apos;s the discipline.
        </p>
      </div>
    );
  }

  const c = data.coach;
  const t = data.topics?.last28Days;
  const d = data.decisions?.last28Days;
  const ch = data.chain;

  // Growth indicator helper — honest pct change vs prior period.
  const chainGrowth =
    ch && ch.prior7Days > 0
      ? Math.round(((ch.last7Days - ch.prior7Days) / ch.prior7Days) * 100)
      : null;

  return (
    <div className="space-y-4">
      <LearningHint
        as="block"
        category="Brain · §3.6"
        title="What the System has noticed lately"
        whatItIs="The §3.6 make-learning-visible panel. Aggregates §3.1 chain events into honest activity readouts so the user can see concrete evidence the System is accumulating something specific to their team — counts the chain accumulated (NOT verdicts), comparison to prior period is signal (NOT judgment), durability (held vs reopened) is the consequence measure (NOT acceptance or click-through)."
        why="Most AI tools claim improvement without showing it. A team six months in can't tell whether they're really getting smarter or whether the System is just running. This panel exists to defeat that: every number here is auditable, every comparison is honest, every claim is bounded by what the chain can actually measure."
        how="Read top-down: headline numbers tell you the rate of accumulation, patterns tell you what the Coach is noticing about communication, durability tells you whether the resolutions are holding. If any number feels off, that's a real signal — tell the team. The point of THIS surface is to make the team's own data inspectable."
        principle="Vanity metrics make AI tools feel smart while changing nothing. The §3.6 discipline is to show ONLY consequence measures and admit when nothing material has accumulated yet."
      >
        <div className="flex items-start gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
          <Eye className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-primary mb-0.5">
              What the System has noticed lately
            </p>
            <p className="text-[11px] text-secondary leading-relaxed">
              Counts the chain accumulated, not verdicts. Comparison to prior
              period is signal, not judgment. Durability (held vs reopened) is
              the consequence measure — acceptance and click-through are not.
            </p>
          </div>
        </div>
      </LearningHint>

      {/* Headline numbers — last 7 days vs prior 7 days */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LearningHint
          category="Brain · Chain"
          title="Chain events · 7d"
          whatItIs="Count of §3.1 chain events the System received in the last 7 days. Every chain event is an immutable record: a task created, a message sent, a problem drafted, a resolution captured, a decision opened — anything the chain tracks."
          why="The chain is the ENTIRE substrate of the team's learning. Without events, the System has nothing to derive from. The 7-day count + the prior-7d comparison tells you whether the team is FEEDING the chain enough material for it to compose any meaningful learning. A team with zero chain events for two weeks running has effectively turned the chain off."
          how="Watch the trend (the +pct% next to the number). A flat or negative trend means the team has reduced its engagement with the structured surfaces — work is happening somewhere else (Slack DMs, email, in-person), uncapturable by the chain. The fix is usually to ask why the team has gravitated off-surface, not to push them back on."
          principle="The chain is what makes everything else possible. Zero events = silent System. The honest team treats this number as the canary."
        >
          <Stat
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Chain events · 7d"
            value={ch?.last7Days ?? 0}
            trend={chainGrowth}
            context={`${ch?.prior7Days ?? 0} prior 7d`}
          />
        </LearningHint>
        <LearningHint
          category="Brain · Coach"
          title="Coach observations · 7d"
          whatItIs="Count of communication-pattern observations the Coach made in the last 7 days. Every time the team's chat surface produces a draft, the Coach reads it and tags any patterns it recognizes (named risks like NVC-evaluation, bare-assertion, identity-collision; or named strengths like next-step-clear, acknowledged)."
          why="The Coach is the per-message lens on communication quality. Its observation rate tells you how much the team is sending content through Coach-active surfaces. A team with rich chain events but zero Coach observations is using the chain WITHOUT communication coaching — fine for some tenants, but the Coach can't help if it's never invoked."
          how="If observations are low, check whether Coach is on (company-wide or per-topic). If observations are high AND patterns concentrate on risks (rather than strengths), that's a signal worth a leader's attention — not for callout, but for a team conversation about communication norms."
          principle="The Coach is a mirror. The observation rate is the rate the team is looking in the mirror — voluntary, not enforced."
        >
          <Stat
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Coach observations · 7d"
            value={c?.last7Days.patternsObserved ?? 0}
            context={`${c?.cumulativePatterns ?? 0} cumulative`}
          />
        </LearningHint>
        <LearningHint
          category="Brain · Decisions"
          title="Decisions decided · 28d"
          whatItIs="Count of Decision Dialogues the team has CLOSED with a chosen path (yours / system's / hybrid / defer) in the last 28 days. The 'opened' context below shows how many were started in the same window — the ratio is the team's decide-vs-defer rate."
          why="Opening a Decision Dialogue is easy. Deciding is what separates structured reasoning from performative reasoning. The decided count is the team's reasoning-to-completion rate."
          how="If opened ≫ decided, the team is starting dialogues without finishing them — possibly because the situation phase is being used as a shared brainstorm rather than as the start of a decision. Decide-rate of 60-80% is healthy; below 40% suggests the team is using the Dialogue UI for something other than its intent."
          principle="A dialogue without a recorded decision is just a transcript. The system gets smarter only when the WHY behind a decision is captured."
        >
          <Stat
            icon={<Brain className="w-3.5 h-3.5" />}
            label="Decisions decided · 28d"
            value={d?.decided ?? 0}
            context={`${d?.opened ?? 0} opened`}
          />
        </LearningHint>
        <LearningHint
          category="Brain · Closure"
          title="Topics closed · 28d"
          whatItIs="Count of Team Chat topics the team has CLOSED via the structured Close Topic flow in the last 28 days. 'Opened' context shows how many were started in the same window."
          why="Like Decisions, opening a topic is easy and closing it requires capturing a summary. The closed count measures the team's discipline of converting conversations into recorded outcomes. A team that opens 50 topics and closes 5 is leaving 45 conversations as institutional memory loss."
          how="If closed ≪ opened, you have a backlog of unclosed conversations. Browse the Open filter periodically; close anything that's actually concluded. The closed topics build the searchable Knowledge surface — they compound; unclosed ones don't."
          principle="Conversation is the substrate; closure is what makes it knowledge. The discipline is in finishing, not starting."
        >
          <Stat
            icon={<MessageSquare className="w-3.5 h-3.5" />}
            label="Topics closed · 28d"
            value={t?.closed ?? 0}
            context={`${t?.opened ?? 0} opened`}
          />
        </LearningHint>
      </div>

      {/* Top patterns Coach noticed this week */}
      <LearningHint
        as="block"
        category="Brain · Patterns"
        title="Top communication patterns the Coach noticed"
        whatItIs="A 7-day ranked list of communication patterns the Coach observed across the team's chat surfaces. Each row is one named pattern (e.g., 'NVC-evaluation', 'voss-bare-assertion', 'stone-identity-collision') with the count of occurrences AND the change from the prior 7 days."
        why="Communication failure modes recur. A team that lets identity-collision happen once will let it happen many times unless someone surfaces the pattern. This panel makes the recurrence VISIBLE so the leadership can decide whether it's worth attending to."
        how="Read the deltas (+ N / - N), not just the totals. A risk-pattern dropping = the team is correcting it. A risk-pattern climbing = the team is leaning further into the pattern. Strength-patterns climbing = the team's communication is sharpening. The conversation about a climbing risk is what produces change — not the data alone."
        principle="Patterns are counts, not verdicts. Surfacing the count is the System's job; deciding what to do is yours."
      >
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-brand" aria-hidden />
          <h3 className="text-sm font-semibold text-primary">
            Top communication patterns the Coach noticed · last 7 days
          </h3>
        </div>
        {(c?.topPatterns?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted leading-relaxed">
            No Coach observations in the last 7 days. Either the team has been
            communicating without triggering any heuristics, or Coach is off
            for the topics where activity happened. The empty state is honest
            signal — not a placeholder.
          </p>
        ) : (
          <ul className="space-y-2">
            {c?.topPatterns.map((p) => {
              const delta = p.count - p.priorCount;
              return (
                <li
                  key={p.heuristicId}
                  className="flex items-center justify-between gap-3 p-2.5 bg-surface border border-default rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-primary font-medium truncate">
                      {HEURISTIC_LABEL[p.heuristicId]}
                    </p>
                    <p className="text-[10px] text-muted font-mono mt-0.5">
                      {p.heuristicId}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {p.count}
                    </span>
                    {p.priorCount > 0 && (
                      <span
                        className={`flex items-center gap-1 text-[10px] font-mono ${
                          delta > 0
                            ? "text-emerald-400"
                            : delta < 0
                              ? "text-secondary"
                              : "text-muted"
                        }`}
                        title={`${p.priorCount} in prior 7 days`}
                      >
                        {delta > 0 ? (
                          <TrendingUp className="w-3 h-3" aria-hidden />
                        ) : delta < 0 ? (
                          <TrendingDown className="w-3 h-3" aria-hidden />
                        ) : null}
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </LearningHint>

      {/* Durability — §3.5 consequence */}
      {t && t.closed > 0 && (
        <LearningHint
          as="block"
          category="Brain · §3.5"
          title="Topic durability"
          whatItIs="The 28-day durability cohort: of the closed topics, how many HELD (the underlying problem didn't reopen), how many were PARTIAL (resolved but with caveats), how many REOPENED (the resolution didn't stick), how many were INCONCLUSIVE (the durability window expired without enough signal). Per §3.5, this is the ONLY metric that measures whether the team's work actually worked."
          why="Activity metrics (topics closed, decisions decided) are vanity until paired with durability. The honest team measures both: count of closure AND rate of durability. A team with 100 closures and a 30% held rate is busy producing low-quality output. A team with 20 closures and a 90% held rate is producing real learning."
          how="Watch held rate over time, not individual numbers. If held rate slides, the team is closing things too quickly — usually a symptom of skipped diagnosis. The fix is investing more in WHY before closing, not closing fewer things."
          principle="The single number that resists vanity. Capture every other metric in light of THIS one."
        >
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2
              className="w-4 h-4 text-emerald-400"
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-primary">
              Topic durability · §3.5 consequence · last 28 days
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <DurabilityChip
              label="Held"
              count={t.durability.held}
              tone="emerald"
            />
            <DurabilityChip
              label="Partial"
              count={t.durability.partial}
              tone="amber"
            />
            <DurabilityChip
              label="Reopened"
              count={t.durability.reopened}
              tone="amber"
            />
            <DurabilityChip
              label="Unknown"
              count={t.durability.unknown}
              tone="muted"
            />
            <DurabilityChip
              label="Unrated"
              count={t.durability.unrated}
              tone="muted"
            />
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            Held resolutions are the only ones that count as validated learning
            per §3.5 — acceptance is not consequence. Unrated topics are
            awaiting a review decision.
          </p>
        </div>
        </LearningHint>
      )}

      {/* Decision paths */}
      {d && d.decided > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-brand" aria-hidden />
            <h3 className="text-sm font-semibold text-primary">
              Decision paths · last 28 days
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <DurabilityChip
              label="User's proposal"
              count={d.byPath.user ?? 0}
              tone="emerald"
            />
            <DurabilityChip
              label="System suggestion"
              count={d.byPath.system ?? 0}
              tone="emerald"
            />
            <DurabilityChip
              label="Hybrid"
              count={d.byPath.hybrid ?? 0}
              tone="emerald"
            />
            <DurabilityChip
              label="Deferred"
              count={d.byPath.defer ?? 0}
              tone="muted"
            />
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            Deferred is the constitutional &ldquo;not enough understanding
            yet&rdquo; — it&apos;s healthy signal, not a failure.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
  trend,
  context,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: number | null;
  context?: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest mb-1">
        <span className="text-brand">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-primary tabular-nums">{value}</p>
        {trend !== null && trend !== undefined && (
          <span
            className={`text-[10px] font-mono ${
              trend > 0
                ? "text-emerald-400"
                : trend < 0
                  ? "text-secondary"
                  : "text-muted"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      {context && (
        <p className="text-[10px] text-muted mt-1 font-mono">{context}</p>
      )}
    </div>
  );
}

function DurabilityChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "emerald" | "amber" | "muted";
}) {
  const styles =
    tone === "emerald"
      ? "bg-emerald-500/5 border-emerald-500/20"
      : tone === "amber"
        ? "bg-ember-400/5 border-ember-400/20"
        : "bg-surface border-default";
  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <p className="text-[10px] uppercase tracking-widest text-secondary mb-0.5">
        {label}
      </p>
      <p className="text-xl font-bold text-primary tabular-nums">{count}</p>
    </div>
  );
}
