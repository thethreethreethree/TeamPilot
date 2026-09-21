import { competitionRanks } from "@/lib/coach/gamification/competitionRank";
import { PRIZE_ELIGIBLE_MIN_PITCHES } from "./rubric";
import { aggregatePitches, type AggregablePitch } from "./aggregate";

/**
 * The Pitch Score competition board.
 *
 * SPECIFIED, not invented. The rubric sheet (p.6) makes Pitch Score the competition leaderboard,
 * and `docs/SYSTEM UPDATES AND REVISION 09-22-2026/TWO-SCORING-SYSTEMS.md` already wrote down the rule this
 * implements: *"Pitch Score leaderboard = total points from counted pitches."* Counted means
 * qualifying — the 40-base test — so a rep cannot climb by handing in pitches that never reached
 * Discovery.
 *
 * THREE DECISIONS ARE CONSUMED HERE, NOT RE-MADE (§2.2):
 *
 *   the per-rep totals      `aggregatePitches`   — including which pitches count and why not
 *   the rank numbering      `competitionRanks`   — standard competition ranking, 1-2-2-4
 *   the prize threshold     `PRIZE_ELIGIBLE_MIN_PITCHES` — 5, matching the app's existing
 *                                                   provisional threshold
 *
 * Each of those has been duplicated somewhere in this codebase before and each duplicate agreed
 * with its authority on the day it was written. A leaderboard is the worst place for that class to
 * land: everyone can see the number, nobody can see the rule.
 *
 * NOTE ON A CONTRADICTION, per the founder's standing instruction on this workstream — noted, not
 * silently applied. `docs/SalesCoach-KPI-System.md` states, and calls non-negotiable:
 *
 *   *"Cross-agent ranking exists for managers only, is never the default view, and is never how
 *   results are framed to the agent."*
 *
 * The rubric sheet makes Pitch Score the competition board, which is cross-agent ranking shown to
 * reps. Both cannot be fully true. This module takes no position: it computes a board and says
 * nothing about who may see it. The `managerOnly` question belongs to the route and the surface,
 * and is recorded in LOGIC-AND-CONTRADICTIONS.md section L rather than resolved by whoever
 * happened to write the query.
 */

export type LeaderboardRow = {
  repId: string;
  /**
   * The ranking key, and it is named `total_points` deliberately.
   *
   * `competitionRanks` takes `RankableRow = { total_points }`. Renaming it to something prettier
   * here would mean mapping into its shape at the call site — one more place the ranking key is
   * decided. The wire name is the authority's name.
   */
  total_points: number;
  /** Qualifying pitches. The denominator for every average, and the prize threshold's input. */
  counted: number;
  /** Everything handed in, so "12 pitches, 7 counted" can be said out loud. */
  pitchesTotal: number;
  avgPitchScore: number;
  bestPitchScore: number | null;
  /** At or above PRIZE_ELIGIBLE_MIN_PITCHES counted pitches. */
  prizeEligible: boolean;
  /** Standard competition rank: two reps on the same total share a place, and the next is skipped. */
  rank: number;
};

/**
 * Build the board from a company-wide period read.
 *
 * Pitches with no `repId` are dropped rather than pooled under a blank key. A pooled row would
 * appear on the board as a nameless rep holding real points — which is worse than a rep missing
 * from a board, because it is a number nobody can attribute or dispute.
 */
export function buildPitchLeaderboard(
  pitches: readonly AggregablePitch[]
): LeaderboardRow[] {
  const byRep = new Map<string, AggregablePitch[]>();
  for (const p of pitches) {
    if (!p.repId) continue;
    const list = byRep.get(p.repId) ?? [];
    list.push(p);
    byRep.set(p.repId, list);
  }

  const rows: LeaderboardRow[] = [];
  for (const [repId, theirs] of byRep) {
    const agg = aggregatePitches(theirs);
    rows.push({
      repId,
      total_points: agg.totalPoints,
      counted: agg.counted,
      pitchesTotal: agg.pitchesTotal,
      avgPitchScore: agg.avgPitchScore,
      bestPitchScore: agg.bestPitchScore,
      prizeEligible: agg.prizeEligible,
      rank: 0, // assigned below, after the sort competitionRanks depends on
    });
  }

  // SORT FIRST. `competitionRanks` documents that it ranks rows ALREADY ordered and deliberately
  // does not re-sort — "the RPC's ordering is the board's ordering, and re-sorting here would be a
  // second opinion about it". Handing it an unsorted array does not throw; it silently produces
  // ranks that ascend with array position, which looks like a working board.
  //
  // The tie-breaks decide display order only. Two reps on an identical total share a rank whatever
  // order they sit in, so these exist to make the output deterministic rather than to break ties:
  // counted descending (more qualifying pitches first, which is the harder way to reach a total),
  // then repId, which is arbitrary but stable across reads.
  rows.sort(
    (a, b) =>
      b.total_points - a.total_points ||
      b.counted - a.counted ||
      a.repId.localeCompare(b.repId)
  );

  const ranks = competitionRanks(rows);
  return rows.map((row, i) => ({ ...row, rank: ranks[i] ?? i + 1 }));
}

/**
 * One rep's standing, or null when they are not on the board.
 *
 * Null is not zero and not last: a rep with no scored pitch has no standing yet, which is a
 * different thing from being bottom. Same distinction `rankOf` makes on the points board, and it
 * matters more here — a rep who has not been recorded this week has not lost the competition.
 */
export function standingOf(rows: readonly LeaderboardRow[], repId: string): LeaderboardRow | null {
  return rows.find((r) => r.repId === repId) ?? null;
}

export { PRIZE_ELIGIBLE_MIN_PITCHES };

/**
 * How far a rep is from the reps immediately above and below them.
 *
 * SPECIFIED. The rep dashboard sheet's Progress board shows, for a rep sitting at #2:
 *
 *     62 pts behind #1        118 pts ahead of #3
 *
 * ADJACENT, not the leader. For a #2 rep the one above IS #1, which makes the sheet's example
 * ambiguous between "the leader" and "the rep above me" — and the pair only makes sense read as
 * neighbours, because the second half is unambiguously the rep below. A gap to the leader would
 * also be demoralising by construction for everyone outside the top three, which is the opposite
 * of what a progress board is for.
 *
 * GAPS, NEVER NAMES. This is what lets a rep see it at all: `docs/SalesCoach-KPI-System.md` forbids
 * cross-agent ranking being how results are framed to an agent, and a distance is not a person. The
 * route hands a rep two numbers and no identities — the same reasoning that gives them "3rd of 9"
 * and nothing else.
 *
 * Null means there is nobody there: the leader has nobody above, the last rep has nobody below, and
 * a rep not on the board has neither. Null is not zero — zero means a tie.
 */
export type Gaps = {
  /** Points needed to catch the rep immediately above. Null when they are already top. */
  behind: number | null;
  /** Points clear of the rep immediately below. Null when they are last. */
  ahead: number | null;
};

export function gapsAround(rows: readonly LeaderboardRow[], repId: string): Gaps {
  const i = rows.findIndex((r) => r.repId === repId);
  if (i < 0) return { behind: null, ahead: null };

  const me = rows[i]!;
  const above = rows[i - 1];
  const below = rows[i + 1];

  // Rounded to one place, and the case it exists for is the one a rep looks hardest at.
  //
  // Totals are one-decimal sums, and most subtractions of them are exact — 80.3 - 18.4 really is
  // 61.9. The float error appears at NEAR-TIES: `100.1 - 100` is 0.09999999999999432. So the
  // unrounded version would be correct everywhere except between two reps who are all but level,
  // which is precisely where the number is read closely, and it would print fifteen decimal places
  // on a board about precision.
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return {
    behind: above ? r1(above.total_points - me.total_points) : null,
    ahead: below ? r1(me.total_points - below.total_points) : null,
  };
}
