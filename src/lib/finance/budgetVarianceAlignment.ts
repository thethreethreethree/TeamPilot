/**
 * Pure mirror of the `fin_budget_variance` period-alignment (migration 0191).
 *
 * The view decides whether a posted journal entry (by its month) belongs to a budget line's period,
 * given the budget's granularity. This TS mirror documents + regression-locks that logic (the SQL
 * itself is verified live on apply). It is NOT wired into a query path — it exists so the alignment
 * intent can't silently drift (the 0149 bug was a quarter-only alignment applied to monthly budgets).
 *
 * period_index: 0 = whole fiscal year; for quarterly budgets 1-4 = quarter; for monthly 1-12 = month.
 */
export type BudgetGranularity = "annual" | "quarterly" | "monthly";

/**
 * True iff an entry in `entryMonth` (1-12) counts toward the budget line at `periodIndex`
 * under `granularity`. Mirrors 0191's `(period_index = 0 OR (quarterly AND quarter=idx) OR (monthly AND month=idx))`.
 */
export function budgetLineMatchesEntryMonth(
  granularity: BudgetGranularity,
  periodIndex: number,
  entryMonth: number
): boolean {
  if (periodIndex === 0) return true; // whole fiscal year, any granularity
  if (granularity === "quarterly") return Math.ceil(entryMonth / 3) === periodIndex; // month→quarter
  if (granularity === "monthly") return entryMonth === periodIndex;
  return false; // annual: only period_index 0 is meaningful; a nonzero annual line matches nothing
}
