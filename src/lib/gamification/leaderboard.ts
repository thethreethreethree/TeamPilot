/**
 * The team scoreboard.
 *
 * WHAT IT IS ALLOWED TO SHOW, and this is the whole design of it: per-agent
 * AGGREGATES only — rank, points, sessions, average, best, deals. Never a
 * per-session score. A rep's individual scores are private to them (the ledger's
 * own policy enforces it), and a leaderboard that leaked them would turn a
 * coaching tool into a surveillance one.
 *
 * EQUALS SHARE A RANK, matching the web exactly.
 *
 * This was positional on both sides until 4 September 2026: the route computed
 * `meRank` as `meIndex + 1`, so of two reps on exactly the same total, one was
 * told they came second. That is false, and it is the kind of thing somebody
 * remembers being told.
 *
 * I raised it rather than settling it quietly, and the owner chose to change
 * BOTH surfaces — which is why the rule below and the web's
 * `src/lib/coach/gamification/competitionRank.ts` are the same rule. The route
 * now returns `rankOf(rows, meIndex)`, so the number this app is TOLD and the
 * number it computes agree. Changing one without the other is how a rep ends up
 * reading "1st" on their phone and "2nd" on the website.
 *
 * A REP WITH NO NAME IS STILL ON THE BOARD. `full_name` is left-joined and can
 * be null; dropping those rows would silently shrink the team and shift
 * everybody's rank. They appear as "A teammate".
 */

import { bandFor } from './points';

export type LeaderboardRow = {
  agentId: string;
  fullName: string | null;
  sessions: number;
  totalPoints: number;
  avgPoints: number;
  bestPoints: number;
  deals: number;
};

export type RankedRow = LeaderboardRow & {
  /** Spec 5.2/5.1: the band comes from the AVERAGE, which is the 0-100 figure. */
  band: string | null;
  rank: number;
  /** True for the signed-in rep, so their own row can be marked. */
  isYou: boolean;
  /** What to print. Never an empty name. */
  displayName: string;
};

export type Period = 'week' | 'month' | 'all';

export const PERIOD_LABEL: Record<Period, string> = {
  week: 'This week',
  month: 'This month',
  all: 'All time',
};

/**
 * Rank the rows, honouring ties.
 *
 * The function already sorts (points, then average, then fewer sessions), so the
 * order is trusted. Only the NUMBER is computed, and only points decide a tie:
 * two reps on the same points share a rank even if their averages differ,
 * because points are what the board is sorted on and what it claims to measure.
 */
/**
 * The server's own ordering, made total.
 *
 * `gamification_leaderboard` orders by
 * `total_points desc, avg_points desc, sessions asc` and stops there. Because
 * `avg = total / sessions`, two reps with the same total AND the same session
 * count tie on all three keys — so Postgres is free to return them in either
 * order, and nothing says it must pick the same one twice. On a small team that
 * pair is not rare.
 *
 * Rank is assigned from the row's position in this order, so an unstable order
 * means a rep can read 4th, pull to refresh, and read 5th with nothing changed.
 * That is a separate problem from the tie POLICY below — equals now DO share a
 * rank — because sharing a rank does not help if the rows themselves arrive in
 * a different order each time. This fixes the ordering underneath the policy.
 *
 * This comparator uses EXACTLY the server's three keys in the server's
 * directions, then `agentId` as a final tiebreak. For any pair the server
 * ordered deterministically it agrees with the server, so it cannot introduce a
 * disagreement; it only settles the case the server leaves open. The sort is
 * stable, so rows that compare equal on every key keep the order they arrived in.
 */
function serverOrder(a: LeaderboardRow, b: LeaderboardRow): number {
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
  if (a.avgPoints !== b.avgPoints) return b.avgPoints - a.avgPoints;
  if (a.sessions !== b.sessions) return a.sessions - b.sessions;
  // The only addition: a stable, arbitrary-but-fixed tiebreak so the same two
  // reps do not swap places between two reads of the same unchanged data.
  return a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0;
}

/**
 * COMPETITION RANKING — two reps on identical points share a rank.
 *
 * The owner's decision, 3 September 2026, after I raised it: previously this
 * used plain position (`i + 1`), matching the route, so of two reps on exactly
 * the same total one was told they came second. That is false, and it is the
 * kind of thing a person remembers.
 *
 * The shape is standard competition ranking: equals share the higher place and
 * the next rank skips — 1, 2, 2, 4. The skip is deliberate. Without it a rep
 * ranked 3rd of five would appear to be beating three people when they are
 * beating two.
 *
 * TIED ON WHAT, EXACTLY: total points. That is the number the board is ordered
 * by and the number a rep reads as their score. Two reps on the same total with
 * different averages still share a rank — the average is shown beside it, and
 * inventing a tiebreak the rep cannot see is how "why am I second?" starts.
 *
 * The website now applies the identical rule — the owner chose BOTH surfaces on
 * 4 September, so a rep cannot read a different standing depending on which one
 * they open. The web side lives in `src/lib/coach/gamification/competitionRank.ts`
 * in the TeamPilot repo and feeds the Scoreboard, the `meRank` this app reads
 * from `/api/coach/gamification/leaderboard`, and the weekly manager digest. If
 * this rule is ever changed here, that module is the one that has to change with
 * it, or the phone and the website start disagreeing again.
 */
export function rank(rows: LeaderboardRow[], meId: string | null): RankedRow[] {
  const out: RankedRow[] = [];
  let lastPoints: number | null = null;
  let lastRank = 0;
  // Never mutate the caller's array — the screen holds it in state.
  [...rows].sort(serverOrder).forEach((r, i) => {
    // Equals share the higher place; the next distinct total takes the position
    // it actually occupies, so the sequence reads 1, 2, 2, 4.
    const rankNumber = lastPoints !== null && r.totalPoints === lastPoints ? lastRank : i + 1;
    lastPoints = r.totalPoints;
    lastRank = rankNumber;
    out.push({
      ...r,
      rank: rankNumber,
      // From the average, not the total: the total is unbounded, and a band is
      // defined over 0-100. A rep with no scored session has no band at all.
      band: r.sessions > 0 ? bandFor(r.avgPoints) : null,
      isYou: !!meId && r.agentId === meId,
      displayName: r.fullName?.trim() || 'A teammate',
    });
  });
  return out;
}

/** Where the signed-in rep sits, or null when they are not on the board yet. */
export function myRank(rows: RankedRow[]): RankedRow | null {
  return rows.find((r) => r.isYou) ?? null;
}

/**
 * Postgres numbers, off the wire.
 *
 * `total_points` is a bigint and `avg_points` a numeric, so PostgREST sends BOTH
 * AS STRINGS. A plain `typeof v === 'number' ? v : 0` reads every total on the
 * board as zero — an entire team showing nothing, with no error raised anywhere,
 * because a string is not a number and zero looks like a real answer.
 *
 * It lives HERE, in the module with no network imports, for the reason this
 * project has now hit seven times: anything importing Supabase cannot load under
 * the test runner, and a parser this load-bearing has to be testable.
 */
export function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
