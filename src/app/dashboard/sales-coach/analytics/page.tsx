"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  TrendingDown,
  GraduationCap,
  Sparkles,
  MessageSquare,
  Lightbulb,
  Users,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * Sales Coach → Analytics (Phase 2).
 *
 * Your OWN coaching analytics over time — cue-reliance trend (the
 * "training wheels come off" signal, §3.5), session volume, reviews, and
 * growth opportunities. Measured against your own past, never ranked
 * against others (§A18). Team-level analytics arrives once the Sales
 * Coach team is defined (Phase 3). Every number is real (§3.4); sparse
 * data shows honestly as "not enough yet", not a fake trend.
 */

type ProgressPoint = { sessionId: string; startedAt: string; cueCount: number };
type Stats = {
  sessionsTotal: number;
  sessionsThisWeek: number;
  activeCount: number;
  awaitingReview: number;
  reviewedCount: number;
  cuesTotal: number;
  reviewsGenerated: number;
  recentGrowth: string[];
};
type TeamStats = {
  sessionsTotal: number;
  sessionsThisWeek: number;
  activeCoaches: number;
  cuesTotal: number;
  reviewsGenerated: number;
  avgCues: number;
};

export default function SalesCoachAnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<ProgressPoint[]>([]);
  // Team aggregate — only populated for managers (the endpoint 403s
  // otherwise, so a non-manager simply never sees the team section).
  const [team, setTeam] = useState<TeamStats | null>(null);
  const [teamSeries, setTeamSeries] = useState<ProgressPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [ownRes, teamRes] = await Promise.all([
        fetch("/api/coach/sales-session/dashboard").catch(() => null),
        fetch("/api/coach/sales-session/team-analytics").catch(() => null),
      ]);
      if (ownRes && ownRes.ok) {
        const d = await ownRes.json();
        setStats(d.stats ?? null);
        setSeries(d.series ?? []);
      }
      if (teamRes && teamRes.ok) {
        const t = await teamRes.json();
        setTeam(t.team ?? null);
        setTeamSeries(t.series ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxCues = Math.max(1, ...series.map((s) => s.cueCount));
  const avgCues =
    series.length > 0
      ? Math.round(
          (series.reduce((a, s) => a + s.cueCount, 0) / series.length) * 10
        ) / 10
      : 0;
  const trend = (() => {
    if (series.length < 3) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last) return null;
    return { first: first.cueCount, last: last.cueCount, down: last.cueCount < first.cueCount };
  })();

  const teamMaxCues = Math.max(1, ...teamSeries.map((s) => s.cueCount));

  return (
    <>
      <TopBar title="Analytics" subtitle="Your coaching over time" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-6">
        <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
          <Users className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-secondary leading-relaxed">
            Tracked against the <span className="text-primary">past</span>, never
            as a ranking (§A18). Your own coaching is below
            {team ? "; the team view is aggregate only — no per-person breakdown" : ""}.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {/* TEAM aggregate — managers only. Anonymized: counts + an
                unnamed trend, never a per-agent breakdown (§A18/§A10). */}
            {team && (
              <section className="rounded-xl border border-ember-400/30 bg-ember-400/[0.03] p-4 space-y-4">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand" aria-hidden />
                  <h2 className="text-sm font-semibold text-primary">
                    Team (aggregate)
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Cell icon={GraduationCap} label="Sessions" value={team.sessionsTotal} sub={`${team.sessionsThisWeek} this week`} />
                  <Cell icon={Users} label="Active coaches" value={team.activeCoaches} sub="Ran ≥1 session" />
                  <Cell icon={MessageSquare} label="Cues delivered" value={team.cuesTotal} sub={`avg ${team.avgCues}/session`} />
                  <Cell icon={Sparkles} label="Reviews" value={team.reviewsGenerated} sub="Generated" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-brand" aria-hidden />
                    <h3 className="text-xs font-semibold text-primary">
                      Team cue reliance over time
                    </h3>
                  </div>
                  {teamSeries.length === 0 ? (
                    <p className="text-xs text-muted">
                      No completed team sessions yet. This fills in as the team
                      finishes sessions.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-end gap-1 h-20">
                        {teamSeries.map((s) => (
                          <div
                            key={s.sessionId}
                            className="flex-1 min-w-[4px] bg-ember-400/30 rounded-t hover:bg-ember-400/50 transition-colors"
                            style={{
                              height: `${Math.max(4, (s.cueCount / teamMaxCues) * 100)}%`,
                            }}
                            title={`${new Date(s.startedAt).toLocaleDateString()} · ${s.cueCount} cues`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-muted mt-2">
                        Each bar is one completed session (unattributed) —
                        oldest → newest. The team trend, not anyone&apos;s
                        scorecard.
                      </p>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Aggregate stats */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Cell icon={GraduationCap} label="Sessions" value={stats?.sessionsTotal ?? 0} sub="All time" />
              <Cell icon={Sparkles} label="Reviews" value={stats?.reviewsGenerated ?? 0} sub="Generated" />
              <Cell icon={MessageSquare} label="Cues delivered" value={stats?.cuesTotal ?? 0} sub={`avg ${avgCues}/session`} />
              <Cell icon={Lightbulb} label="Growth areas" value={stats?.recentGrowth.length ?? 0} sub="To practice" />
            </section>

            {/* Cue-reliance trend (§3.5) — the core analytic */}
            <section className="rounded-xl border border-default bg-white/[0.01] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown className="w-3.5 h-3.5 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Cue reliance over time
                </h2>
              </div>
              {series.length === 0 ? (
                <p className="text-xs text-muted">
                  No completed sessions yet. This fills in as you finish
                  sessions — each bar is one session, and the goal is the bars
                  trending down (fewer cues needed over time).
                </p>
              ) : (
                <>
                  <div className="flex items-end gap-1.5 h-28">
                    {series.map((s) => (
                      <div
                        key={s.sessionId}
                        className="flex-1 min-w-[6px] bg-ember-400/30 rounded-t hover:bg-ember-400/50 transition-colors"
                        style={{
                          height: `${Math.max(4, (s.cueCount / maxCues) * 100)}%`,
                        }}
                        title={`${new Date(s.startedAt).toLocaleDateString()} · ${s.cueCount} cues`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    Oldest → newest, left to right. Each bar is one session&apos;s
                    cue count.
                  </p>
                  {trend ? (
                    <p className="text-xs text-secondary leading-relaxed mt-2">
                      From{" "}
                      <span className="text-primary font-semibold">{trend.first}</span>{" "}
                      to{" "}
                      <span className="text-primary font-semibold">{trend.last}</span>{" "}
                      cues per session.{" "}
                      {trend.down
                        ? "Fewer cues over time — the training wheels are coming off."
                        : "Keep going — the goal is fewer cues as the moves become yours."}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted mt-2">
                      Need at least 3 completed sessions to call a trend
                      honestly.
                    </p>
                  )}
                </>
              )}
            </section>

            {/* Growth opportunities */}
            {stats && stats.recentGrowth.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                  Recurring growth opportunities
                </h2>
                <div className="rounded-xl border border-default bg-white/[0.02] divide-y divide-default overflow-hidden">
                  {stats.recentGrowth.map((g, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                      <p className="text-xs text-secondary leading-relaxed">{g}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Cell({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof GraduationCap;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-default bg-surface/40 p-4">
      <div className="flex items-center gap-1.5 mb-2 text-secondary">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        <p className="text-[10px] uppercase tracking-widest font-bold">{label}</p>
      </div>
      <p className="text-2xl font-bold text-primary mb-0.5">{value}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}
