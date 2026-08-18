/**
 * Door Log KPI mapping (Macro Mode — Tab 1, 2.2). Pure, decision-independent logic.
 *
 * The client named four KPIs — doors knocked (total), sold, go-backs, not interested — and two further
 * outcomes exist in the flow (`no_answer`, `non_decision_maker`). The data model counts all SIX; the UI
 * renders the four named ones as primary tiles and the other two behind tap-to-expand (Q1 pending —
 * this module stays correct either way). The client was explicit: a `no_answer` STILL counts as a door
 * knocked ("you knocked a door, but didn't get an answer").
 *
 * `doors_knocked` = the total count of knock rows, regardless of outcome. Independent of Q2/Q4/Q5/toggle.
 */

/** Every possible outcome of a door knock (the Postgres `knock_outcome` enum will mirror this order). */
export const KNOCK_OUTCOMES = [
  "no_answer",
  "sold",
  "go_back",
  "non_decision_maker",
  "not_interested",
] as const;
export type KnockOutcome = (typeof KNOCK_OUTCOMES)[number];

/** The four client-named primary KPI tiles (rendered alongside the doors-knocked total). */
export const PRIMARY_KPI_OUTCOMES = ["sold", "go_back", "not_interested"] as const;
/** The two outcomes shown behind tap-to-expand (Q1 — flag, don't silently choose). */
export const SECONDARY_KPI_OUTCOMES = ["no_answer", "non_decision_maker"] as const;

/**
 * Every knock counts toward doors-knocked — including `no_answer` (client-explicit). This is a function
 * (not a constant `true`) so the intent is a named, testable contract rather than an implicit assumption.
 */
export function countsTowardDoorsKnocked(_outcome: KnockOutcome): boolean {
  return true;
}

export type KpiCounts = { doorsKnocked: number } & Record<KnockOutcome, number>;

/** Tally a list of knock outcomes into the KPI counts. `doorsKnocked` is the total of all knocks. */
export function tallyOutcomes(outcomes: KnockOutcome[]): KpiCounts {
  const counts: KpiCounts = {
    doorsKnocked: 0,
    no_answer: 0,
    sold: 0,
    go_back: 0,
    non_decision_maker: 0,
    not_interested: 0,
  };
  for (const o of outcomes) {
    counts[o] += 1;
    if (countsTowardDoorsKnocked(o)) counts.doorsKnocked += 1;
  }
  return counts;
}
