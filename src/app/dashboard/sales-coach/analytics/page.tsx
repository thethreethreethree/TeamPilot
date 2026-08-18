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
import { gradeSkill } from "@/lib/coach/v5/skillGrade";

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
 * against others (§A18). Every number is real (§3.4); sparse data shows
 * honestly as "not enough yet", not a fake trend.
 *
 * MODE SPLIT (ELOSALES Standard revision): EXPERT keeps the ELO badge + the anonymized team AGGREGATE (no
 * per-person breakdown). STANDARD is role-conditional — a MANAGER gets a roster → per-rep profile (named
 * grades + the counts behind them), which is a per-person breakdown by design, per the revision spec. The
 * on-page copy is therefore ALSO mode-split: Expert's "aggregate only" promise is true for Expert and would be
 * a lie in Standard, so each mode states what is actually visible in it.
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
  // Your-own-stats fetch failed. Kept separate from "no sessions yet" so a transient error never renders as
  // Sessions 0 · Reviews 0 · Cues 0 (error-as-no-data / INV22) — mirrors teamDegraded for the team half.
  const [ownError, setOwnError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Standard (spec p3): Analytics is "all about the user" — six per-skill /10
  // scores + short AI breakdowns, no ELO number, no team aggregate. Expert keeps
  // today's full analytics. We fetch the skill scores only in Standard.
  const { isStandard } = useExperienceMode();
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [skillSessions, setSkillSessions] = useState(0);
  // Skills fetch failed — distinct from skills===null (loading) so SkillScores shows an honest error instead of
  // spinning "Reading your recent calls…" forever on a swallowed failure (INV22, error-as-no-data).
  const [skillsError, setSkillsError] = useState(false);

  useEffect(() => {
    if (!isStandard) return;
    let cancelled = false;
    setSkillsError(false);
    void fetch("/api/coach/sales-session/skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setSkillsError(true); // a 5xx/401 is an ERROR, not "no scored calls yet"
          return;
        }
        setSkills(d.skills ?? []);
        setSkillSessions(d.sampleSessions ?? 0);
      })
      .catch(() => {
        if (!cancelled) setSkillsError(true); // network failure — an error, not empty
      });
    return () => {
      cancelled = true;
    };
  }, [isStandard]);

  const load = useCallback(async () => {
    setOwnError(false);
    try {
      const [ownRes, teamRes] = await Promise.all([
        fetch("/api/coach/sales-session/dashboard").catch(() => null),
        fetch("/api/coach/sales-session/team-analytics").catch(() => null),
      ]);
      if (ownRes && ownRes.ok) {
        const d = await ownRes.json();
        setStats(d.stats ?? null);
        setSeries(d.series ?? []);
      } else {
        // Network error or a 5xx — an ERROR, not a rep with zero activity (INV22). The render shows an
        // honest "couldn't load" instead of all-zero cells.
        setOwnError(true);
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
        {/* ELOSALES revision (PDF Analytics section B) — STANDARD is ROLE-CONDITIONAL: a MANAGER sees the
            team roster → per-rep profile (grades + the counts behind them); a REP sees their OWN six skills
            with the SAME grade the manager reads (A10 — no shadow read), which is the `fallback` below.
            Either way the ELO number stays Expert-only. Role split lives in StandardAnalyticsManagerView
            (team endpoint's isManager). The Expert branch below is untouched. */}
        {isStandard && (
          <StandardAnalyticsManagerView
            fallback={<SkillScores skills={skills} sampleSessions={skillSessions} error={skillsError} />}
          />
        )}

        {/* Your OWN Sales Effectivity Rating (§A10 — the rep sees what the System
            reads about them). Self-framed as you-vs-the-standard, not a rank.
            Expert only: spec p3 removes the ELO number from Standard. */}
        {!isStandard && <AgentEloBadge self />}
        {/* EXPERT ONLY — this copy promises "aggregate only, no per-person breakdown", which is TRUE of the
            Expert team view and FALSE of Standard since the ELOSALES revision built exactly that per-person
            breakdown for managers. Leaving it un-gated told a Standard rep their manager sees only an
            anonymized aggregate while their manager was reading their name, their grades and their recordings —
            a false statement to a person about who is watching them (§3.4 / A10). Standard's honest version is
            below. Expert's copy is unchanged. */}
        {!isStandard && (
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
        )}

        {/* STANDARD — the honest counterpart. In Standard a manager CAN open a named rep and read their grades,
            the counts behind them, and their recent recordings. That is stated plainly here, because the
            alternative is a product that reassures someone their manager isn't looking while their manager is
            looking. A10's contract is not just "you can see the read" — it is that the rep is never misled about
            what is read about them.

            ROLE-NEUTRAL BY CONSTRUCTION (A14): this hint renders under `isStandard` for BOTH readers — the role
            split lives inside StandardAnalyticsManagerView (it owns the team fetch), so this surface does not
            know who is reading it. The first draft was rep-framed ("YOUR manager can open YOUR profile") and
            therefore rendered nonsense to a manager, who is not looking at their own profile — A14's exact
            shape: one render branch verified, the sibling never walked. The copy below is written to be TRUE
            read from either seat rather than plumbing role state up to the page for a paragraph. */}
        {isStandard && (
          <LearningHint
            as="block"
            category="Sales Coach · Analytics"
            title="Grades here are visible to both the rep and their manager"
            whatItIs="The framing for Analytics in Standard: six skills, scored from recent calls, each shown with the count it came from. A manager can open any rep on their team and read those same grades and counts, and can see that rep's recordings from the last 2 days. The rep sees exactly the same grades on this screen."
            why="A coaching tool that shows a manager something the rep cannot see is surveillance wearing a coaching label. This surface refuses that: there is no read a manager has about a rep that the rep cannot read themselves — same grades, same counts. Both parties are told what is visible, rather than left to assume."
            how="Read skills as a trend against your own past, not against other people. Managers: the count under each grade is the thing to coach on — it is specific, and the rep can check it. Reps: if a grade comes up, the count behind it is right here — a count is something you can argue with."
            principle="A read about you that you can't see is a read you can't answer."
          >
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
              <Users className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-secondary leading-relaxed">
                In Standard, a manager can open a rep&apos;s profile and see{" "}
                <span className="text-primary">these same grades</span> and their recordings from the
                last 2 days — and the rep sees every grade their manager sees (§A10). Tracked against
                your own past, never as a ranking (§A18).
              </p>
            </div>
          </LearningHint>
        )}

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

            {ownError ? (
              <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                <p className="text-xs text-amber-300">
                  Couldn&apos;t load your analytics right now — this is an error,
                  not zero activity. Try again shortly.
                </p>
              </section>
            ) : (
              <>
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
  error,
}: {
  skills: SkillRow[] | null;
  sampleSessions: number;
  error: boolean;
}) {
  if (error && skills === null) {
    return (
      <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-center">
        <p className="text-xs text-amber-300">
          Couldn&apos;t read your recent calls right now — this is an error, not
          an empty history. Try again shortly.
        </p>
      </section>
    );
  }
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
          {" "}This is the same read your manager sees about you.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {skills.map((s) => {
          const scored = s.score !== null;
          // A10 — "the user sees the same data, WITH THE SAME LEVEL OF DETAIL." The manager's per-rep profile
          // renders a letter grade for each skill; until this line the rep could only see the /10 and could
          // not see the letter their manager was reading — a derived read about them they had no surface for,
          // which is A10's definition of a shadow read. This revision CREATED that asymmetry, so it repairs
          // it: same grade, same screen, so a rep can challenge or use what is said about them.
          const grade = gradeSkill(s.score);
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
                <div className="flex items-baseline gap-1.5">
                  {grade.letter && (
                    <span className={`text-xs font-bold ${tone}`}>{grade.letter}</span>
                  )}
                  <p className={`text-lg font-bold tabular-nums ${tone}`}>
                    {scored ? `${s.score}/10` : "—"}
                  </p>
                </div>
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
