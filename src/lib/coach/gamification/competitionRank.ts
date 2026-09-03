/**
 * competitionRank — two reps on identical points share a rank.
 *
 * WHY THIS EXISTS. The scoreboard previously ranked by plain POSITION: the row
 * index plus one, both in the route's `meRank` and in the table itself. So of
 * two reps on exactly the same total, one was told they came second. That is
 * false, and it is the kind of thing a person remembers being told.
 *
 * The founder's decision (4 September 2026) was to use competition ranking on
 * BOTH surfaces — the website and the mobile app — so a rep never reads a
 * different standing depending on which one they open.
 *
 * THE SHAPE: equals share the higher place and the next distinct total takes the
 * position it actually occupies — 1, 2, 2, 4. The skip is deliberate. Without it
 * a rep ranked 3rd of five would appear to be beating three people when they are
 * beating two.
 *
 * TIED ON WHAT: `total_points`, the value the board is ordered by and the number
 * a rep reads as their score. Two reps on the same total share a rank even when
 * their averages differ — the average is shown beside it, and inventing a
 * tiebreak the rep cannot see on screen is how "why am I second?" begins.
 *
 * NUMBERS ARRIVE AS STRINGS. `total_points` is a `bigint` in the 0243 aggregate
 * and PostgREST serialises bigint and numeric as STRINGS to preserve precision.
 * Comparing the raw values would make "200" and 200 look like different totals
 * and quietly stop two tied reps from sharing a rank. Everything is coerced once,
 * here, rather than at each call site.
 */

/** The single field ranking depends on. Anything with a total can be ranked. */
export type RankableRow = { total_points: number | string | null | undefined };

/** Coerce the wire value. Non-numeric becomes 0 — an unreadable total is not a score. */
function points(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Competition ranks for rows ALREADY ordered by the aggregate function.
 *
 * Returns one rank per row, in the same order. It does not re-sort: the RPC's
 * ordering is the board's ordering, and re-sorting here would be a second
 * opinion about it.
 */
export function competitionRanks(rows: readonly RankableRow[]): number[] {
  const ranks: number[] = [];
  let lastPoints: number | null = null;
  let lastRank = 0;
  rows.forEach((row, i) => {
    const p = points(row.total_points);
    const rank = lastPoints !== null && p === lastPoints ? lastRank : i + 1;
    lastPoints = p;
    lastRank = rank;
    ranks.push(rank);
  });
  return ranks;
}

/**
 * One caller's own rank, or null when they are not on the board.
 *
 * Null is not zero and not "last": a rep with no scored session has no standing
 * yet, which is a different thing from being bottom of the list.
 */
export function rankOf(rows: readonly RankableRow[], index: number): number | null {
  if (index < 0 || index >= rows.length) return null;
  return competitionRanks(rows)[index] ?? null;
}
