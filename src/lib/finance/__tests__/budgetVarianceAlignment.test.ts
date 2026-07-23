import { describe, it, expect } from "vitest";
import { budgetLineMatchesEntryMonth } from "../budgetVarianceAlignment";

/**
 * Locks the fin_budget_variance period-alignment (migration 0191). The 0149 bug aligned EVERY budget by
 * quarter (extract(quarter)=period_index), which is wrong for MONTHLY budgets: months 5-12 matched zero
 * actuals, months 1-4 mis-aligned to the same-numbered quarter. These cases pin the corrected logic.
 */
describe("budgetLineMatchesEntryMonth — 0191 granularity-aware alignment", () => {
  it("period 0 = whole fiscal year, matches any month for any granularity", () => {
    for (const g of ["annual", "quarterly", "monthly"] as const)
      for (let m = 1; m <= 12; m++) expect(budgetLineMatchesEntryMonth(g, 0, m)).toBe(true);
  });

  it("quarterly: period_index is the QUARTER (1-4); each month maps to its quarter", () => {
    expect(budgetLineMatchesEntryMonth("quarterly", 3, 8)).toBe(true); // Aug → Q3
    expect(budgetLineMatchesEntryMonth("quarterly", 3, 9)).toBe(true); // Sep → Q3
    expect(budgetLineMatchesEntryMonth("quarterly", 3, 1)).toBe(false); // Jan → Q1
    expect(budgetLineMatchesEntryMonth("quarterly", 1, 3)).toBe(true); // Mar → Q1
    expect(budgetLineMatchesEntryMonth("quarterly", 4, 12)).toBe(true); // Dec → Q4
  });

  it("monthly: period_index is the MONTH (1-12) — THE FIX (0149 gave these wrong)", () => {
    expect(budgetLineMatchesEntryMonth("monthly", 3, 3)).toBe(true); // March budget ↔ March postings
    expect(budgetLineMatchesEntryMonth("monthly", 3, 7)).toBe(false); // March budget ✗ July postings
    // 0149 BUG cases — months 5-12 matched ZERO actuals under quarter-alignment; now correct:
    expect(budgetLineMatchesEntryMonth("monthly", 8, 8)).toBe(true); // Aug budget ↔ Aug postings
    expect(budgetLineMatchesEntryMonth("monthly", 12, 12)).toBe(true); // Dec budget ↔ Dec postings
    expect(budgetLineMatchesEntryMonth("monthly", 8, 5)).toBe(false); // Aug budget ✗ May postings
    // 0149 MIS-ALIGN case — a period-3 monthly line used to match Q3 (Jul-Sep); now only March:
    expect(budgetLineMatchesEntryMonth("monthly", 3, 8)).toBe(false); // March budget ✗ Aug (was wrongly true)
  });

  it("annual: only the whole-year line (period 0) is meaningful; a nonzero annual line matches nothing", () => {
    expect(budgetLineMatchesEntryMonth("annual", 1, 1)).toBe(false);
    expect(budgetLineMatchesEntryMonth("annual", 5, 5)).toBe(false);
  });
});
