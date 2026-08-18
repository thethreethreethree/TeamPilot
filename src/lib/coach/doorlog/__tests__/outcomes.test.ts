import { describe, it, expect } from "vitest";
import {
  KNOCK_OUTCOMES,
  countsTowardDoorsKnocked,
  tallyOutcomes,
  type KnockOutcome,
} from "../outcomes";

/**
 * 5.2 — outcome → KPI mapping for all six outcomes; `no_answer` MUST increment doors-knocked.
 */
describe("Door Log outcome → KPI mapping", () => {
  it("every outcome counts toward doors knocked — including no_answer (client-explicit)", () => {
    for (const o of KNOCK_OUTCOMES) {
      expect(countsTowardDoorsKnocked(o)).toBe(true);
    }
  });

  it("tallies each outcome and totals doors knocked across all of them", () => {
    const outcomes: KnockOutcome[] = [
      "no_answer",
      "no_answer",
      "sold",
      "go_back",
      "non_decision_maker",
      "not_interested",
      "sold",
    ];
    const c = tallyOutcomes(outcomes);
    expect(c.doorsKnocked).toBe(7); // ALL knocks, no_answer included
    expect(c.no_answer).toBe(2);
    expect(c.sold).toBe(2);
    expect(c.go_back).toBe(1);
    expect(c.non_decision_maker).toBe(1);
    expect(c.not_interested).toBe(1);
    // doors knocked equals the sum of the per-outcome counts (no double-count, no drop)
    const perOutcome = c.no_answer + c.sold + c.go_back + c.non_decision_maker + c.not_interested;
    expect(perOutcome).toBe(c.doorsKnocked);
  });

  it("an empty day is all zeros, not NaN", () => {
    const c = tallyOutcomes([]);
    expect(c.doorsKnocked).toBe(0);
    for (const o of KNOCK_OUTCOMES) expect(c[o]).toBe(0);
  });
});
