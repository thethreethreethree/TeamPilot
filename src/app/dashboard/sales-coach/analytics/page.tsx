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
import { LearningHint } from "@/components/learning/LearningHint";
import { AgentEloBadge } from "@/components/sales-coach/AgentEloBadge";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import { StandardAnalyticsManagerView } from "@/components/sales-coach/StandardAnalyticsManagerView";

type SkillRow = {
  key: string;
  label: string;
  score: number | null;
  sampleSize: number;
  read: string;
  breakdown: string;
};

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
  capped: boolean;
  cuesExact: boolean;
};

// Below this many active coaches the team TREND is suppressed — with 1-2
// coaches an "aggregate" trend is effectively one person's scorecard
// (§A18/§A10). Headline counts still show (coarse aggregate).
const MIN_COACHES_FOR_TREND = 3;

export default function SalesCoachAnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<ProgressPoint[]>([]);
  // Team aggregate — only populated for managers (the endpoint 403s
  // otherwise, so a non-manager simply never sees the team section).
  const [team, setTeam] = useState<TeamStats | null>(null);
  const [teamSeries, setTeamSeries] = useState<ProgressPoint[]>([]);
  // The manager IS known but the team data failed to load — shown as an
  // honest error, not as zeros (§3.4).
  const [teamDegraded, setTeamDegraded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Standard (spec p3): Analytics is "all about the user" — six per-skill /10
  // scores + short AI breakdowns, no ELO number, no team aggregate. Expert keeps
  // today's full analytics. We fetch the skill scores only in Standard.
  const { isStandard } = useExperienceMode();
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [skillSessions, setSkillSessions] = useState(0);

  useEffect(() => {
    if (!isStandard) return;
    let cancelled = false;
    void fetch("/api/coach/sales-session/skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setSkills(d.skills ?? []);
        setSkillSessions(d.sampleSessions ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isStandard]);

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
        if (t.degraded) {
          setTeamDegraded(true);
        } else {
          setTeam(t.team ?? null);
          setTeamSeries(t.series ?? []);
        }
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
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-6 bg-base">
        {/* STANDARD (spec p3): six per-skill /10 scores + short AI breakdowns —
            the rep's own mirror for "learning from their day". Replaces the ELO
            number (removed below for Standard) so focus shifts to tone, questions,
            etc. — the things a rep can actually work on — not one opaque rating. */}
        {/* ELOSALES revision (PDF Analytics §B): in Standard, a MANAGER sees the team roster → per-rep
            profile; a REP still sees their own scores (A10 self-view = the fallback). Expert branch below is
            untouched. Role split lives in StandardAnalyticsManagerView (team endpoint's isManager). */}
        {isStandard && (
          <StandardAnalyticsManagerView
            fallback={<SkillScores skills={skills} sampleSessions={skillSessions} />}
          />
        )}

        {/* Your OWN Sales Effectivity Rating (§A10 — the rep sees what the System
            reads about them). Self-framed as you-vs-the-standard, not a rank.
            Expert only: spec p3 removes the ELO number from Standard. */}
        {!isStandard && <AgentEloBadge self />}
        <LearningHint
          as="block"
          category="Sales Coach · Analytics"
          title="Measured against your past, not ranked"
          whatItIs="The framing for Analytics: your coaching over time, tracked against your OWN history — and, for managers, an aggregate team view with no per-person breakdown."
          why="Analytics is where a coaching tool is most tempting to misuse as a leaderboard. This surface refuses that: individual trends are yours; the team view is anonymized aggregate only. Your coach sees the same signal — to coach, never to rank."
          how="Read your own charts as a trend against your past. Managers: use the team aggregate to see whether the whole team's reliance is falling — never to compare named people."
          principle="The number that ranks people is the number that gets gamed and feared."
        >
          <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
            <Users className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-secondary leading-relaxed">
              Tracked against the <span className="text-primary">past</span>, never
              as a ranking (§A18). Your own coaching is below
              {team ? "; the team view is aggregate only — no per-person breakdown" : ""}.{" "}
              Your coach sees this same growth signal — for coaching, never
              ranking (§A10).
            </p>
          </div>
        </LearningHint>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {/* TEAM aggregate — managers only, Expert only. Spec p3 makes the
                Standard Analytics page all about the user, so the team view is
                removed there even for a manager (they still have it in Expert). */}
            {!isStandard && teamDegraded && (
              <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                <p className="text-xs text-amber-300">
                  Couldn&apos;t load team analytics right now — this is an
                  error, not an empty team. Try again shortly.
                </p>
              </section>
            )}
            {!isStandard && team && (
              <LearningHint
                as="block"
                category="Sales Coach · Analytics"
                title="Team (aggregate)"
                whatItIs="The manager-only team view: total sessions, active coaches, cues, reviews, and an UNATTRIBUTED cue-reliance trend across everyone — no per-person breakdown."
                why="A team lead needs to know whether coaching is landing without turning it into surveillance. It's deliberately anonymized — the trend is suppressed below 3 active coaches (with 1-2 it would just be one person's scorecard). Aggregate helps; per-person ranking harms (§A18)."
                how="Watch whether the team's overall cue reliance trends down. To help a specific rep, coach them from their own session pages — not from a ranking here (there isn't one)."
                principle="See the team's health without exposing any individual to comparison."
              >
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
                {team.capped && (
                  <p className="text-[11px] text-amber-300/80">
                    {team.cuesExact
                      ? "Active-coach count is over the most recent 500 sessions; session and cue totals are all-time."
                      : "Active-coach count and cue total are over the most recent 500 sessions; session totals are all-time."}
                  </p>
                )}
                {team.activeCoaches < MIN_COACHES_FOR_TREND ? (
                  <p className="text-xs text-muted">
                    The team trend appears once at least {MIN_COACHES_FOR_TREND}{" "}
                    coaches are active — below that it would just be one
                    person&apos;s sessions, which is a scorecard, not a team
                    view (§A18).
                  </p>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingDown className="w-3.5 h-3.5 text-brand" aria-hidden />
                      <h3 className="text-xs font-semibold text-primary">
                        Team cue reliance over time
                      </h3>
                    </div>
                    {teamSeries.length === 0 ? (
                      <p className="text-xs text-muted">
                        No completed team sessions yet. This fills in as the
                        team finishes sessions.
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
                )}
              </section>
              </LearningHint>
            )}

            {/* Aggregate stats */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LearningHint as="block" category="Sales Coach · Analytics" title="Sessions (all time)"
                whatItIs="Your total number of coaching sessions ever — the size of your practice history."
                why="It's the denominator for everything else here. A big history with few reviews means lessons went unpulled; the raw count alone isn't growth."
                how="Read it next to Reviews — the gap between them is your un-learned backlog."
                principle="Volume isn't progress; reviewed volume is.">
                <Cell icon={GraduationCap} label="Sessions" value={stats?.sessionsTotal ?? 0} sub="All time" />
              </LearningHint>
              <LearningHint as="block" category="Sales Coach · Analytics" title="Reviews generated"
                whatItIs="How many of your sessions have a growth review."
                why="Reviews are where the learning is extracted. Reviews far below sessions means you're recording calls but not mining them."
                how="Aim for reviews to track sessions closely — the gap is lessons left on the table."
                principle="A call you don't review is a call you can only repeat.">
                <Cell icon={Sparkles} label="Reviews" value={stats?.reviewsGenerated ?? 0} sub="Generated" />
              </LearningHint>
              <LearningHint as="block" category="Sales Coach · Analytics" title="Cues delivered"
                whatItIs="Total live cues across your sessions, with the average per session."
                why="The average is the real signal: a falling average means the coach's help is becoming yours. A flat, high average means the skill hasn't transferred yet."
                how="Watch the average trend down over time; the cue-reliance chart below shows it session by session."
                principle="The coach is winning when the average falls.">
                <Cell icon={MessageSquare} label="Cues delivered" value={stats?.cuesTotal ?? 0} sub={`avg ${avgCues}/session`} />
              </LearningHint>
              <LearningHint as="block" category="Sales Coach · Analytics" title="Growth areas to practice"
                whatItIs="The count of recurring, practiceable growth areas surfaced from your reviews."
                why="Recurring areas are the patterns worth drilling — the fixes that would move your numbers the most."
                how="Pick one recurring area and drill it across your next doors until it stops recurring."
                principle="The recurring miss is the highest-leverage fix.">
                <Cell icon={Lightbulb} label="Growth areas" value={stats?.recentGrowth.length ?? 0} sub="To practice" />
              </LearningHint>
            </section>

            {/* Cue-reliance trend (§3.5) — the core analytic */}
            <LearningHint
              as="block"
              category="Sales Coach · Analytics"
              title="Cue reliance over time"
              whatItIs="A bar per completed session showing how many live cues you needed, oldest → newest — the core coaching analytic."
              why="This is the training-wheels-coming-off chart. Bars trending down is the whole point: the moves are becoming yours. It's honest about sparsity — it needs ≥3 sessions before it calls a trend."
              how="Look for the downward slope over time, not one session. If it's climbing, your reviews aren't sticking — drill one growth area."
              principle="Fewer cues over time is the measure of a coach that worked."
            >
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
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
            </LearningHint>

            {/* Growth opportunities */}
            {stats && stats.recentGrowth.length > 0 && (
              <LearningHint
                as="block"
                category="Sales Coach · Analytics"
                title="Recurring growth opportunities"
                whatItIs="Growth opportunities that keep showing up across your reviews — the patterns, not one-offs."
                why="A one-off is noise; a recurring miss is a habit costing you deals. These are the highest-leverage things to fix."
                how="Drill the top recurring one until it stops appearing here."
                principle="Fix the recurring miss and the one-offs mostly take care of themselves."
              >
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                  Recurring growth opportunities
                </h2>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm divide-y divide-default overflow-hidden">
                  {stats.recentGrowth.map((g, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                      <p className="text-xs text-secondary leading-relaxed">{g}</p>
                    </div>
                  ))}
                </div>
              </section>
              </LearningHint>
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

/**
 * Standard Analytics (spec p3): six per-skill /10 scores + a short AI breakdown
 * each. The point of the /10-per-skill view (over one ELO number) is that it tells
 * a rep WHICH skill to work — tone, questions, closing — not just "you're a 6".
 *
 * §3.4 throughout: a skill we couldn't score yet shows "—" and an honest "not
 * enough sessions yet", never 0 (0 reads as "you're terrible at this"). A low score
 * is coloured as the thing to work on, never hidden.
 */
function SkillScores({
  skills,
  sampleSessions,
}: {
  skills: SkillRow[] | null;
  sampleSessions: number;
}) {
  if (skills === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted py-8 justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Reading your recent calls…
      </div>
    );
  }
  if (skills.length === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-center">
        <p className="text-xs text-muted">
          No scored calls yet. Run a session and your skills will show up here —
          one score per skill, so you know exactly what to work on next.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-primary">Your skills</h2>
        <p className="text-[11px] text-muted">
          Across your last {sampleSessions} scored{" "}
          {sampleSessions === 1 ? "call" : "calls"} — your own mirror, not a ranking.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {skills.map((s) => {
          const scored = s.score !== null;
          // Low scores are the point — colour them so the eye lands on what to work
          // on. Null (unmeasured) is neutral grey, never red.
          const tone = !scored
            ? "text-muted"
            : s.score! >= 8
              ? "text-emerald-300"
              : s.score! >= 5
                ? "text-brand"
                : "text-amber-300";
          return (
            <div
              key={s.key}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 flex flex-col"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted">
                  {s.label}
                </p>
                <p className={`text-lg font-bold tabular-nums ${tone}`}>
                  {scored ? `${s.score}/10` : "—"}
                </p>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-secondary">
                {s.breakdown}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
