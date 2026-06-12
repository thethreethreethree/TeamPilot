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

      {/* Headline numbers — last 7 days vs prior 7 days */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Chain events · 7d"
          value={ch?.last7Days ?? 0}
          trend={chainGrowth}
          context={`${ch?.prior7Days ?? 0} prior 7d`}
        />
        <Stat
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Coach observations · 7d"
          value={c?.last7Days.patternsObserved ?? 0}
          context={`${c?.cumulativePatterns ?? 0} cumulative`}
        />
        <Stat
          icon={<Brain className="w-3.5 h-3.5" />}
          label="Decisions decided · 28d"
          value={d?.decided ?? 0}
          context={`${d?.opened ?? 0} opened`}
        />
        <Stat
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Topics closed · 28d"
          value={t?.closed ?? 0}
          context={`${t?.opened ?? 0} opened`}
        />
      </div>

      {/* Top patterns Coach noticed this week */}
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

      {/* Durability — §3.5 consequence */}
      {t && t.closed > 0 && (
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
