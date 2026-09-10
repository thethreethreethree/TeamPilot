import { describe, it, expect } from "vitest";
import {
  DERIVED_GOAL_CEILING,
  STARTER_DAILY_SALES_GOAL,
  deriveDailySalesGoal,
  goalBasisSentence,
} from "../deriveGoal";

/**
 * The daily sales goal, derived rather than typed in.
 *
 * This number decides every rep's whole day: the sold target IS the goal, the
 * presentations target is the goal over the close ratio, and the doors target is
 * that over the contact ratio. Get it wrong and a rep is either told to knock
 * two hundred doors or is finished by ten in the morning.
 */
describe("deriveDailySalesGoal", () => {
  it("uses what the rep actually closes, once they close anything", () => {
    // 6 sales across 4 working days is 1.5 a day; the goal is the rate they
    // already achieve, rounded up.
    expect(deriveDailySalesGoal({ sold: 6, presentations: 40, doors: 300, activeDays: 4 })).toEqual({
      goal: 2,
      basis: "own-sales",
    });
  });

  it("falls back to the rep's own DOORS when there are no sales yet", () => {
    /*
     * The case that actually exists in production today: 613 door knocks in the
     * company and zero recorded outcomes. A goal derived from sales would be 0
     * for every rep in the business.
     *
     * 80 doors a day through the starter funnel (1 presentation per 4.4 doors,
     * 1 sale per 9 presentations) is 2.02 sales — the same arithmetic the target
     * card shows the rep, run in reverse.
     */
    const r = deriveDailySalesGoal({ sold: 0, presentations: 18, doors: 800, activeDays: 10 });
    expect(r).toEqual({ goal: 3, basis: "own-activity" });
  });

  it("gives a brand-new rep the starter goal rather than an empty screen", () => {
    expect(deriveDailySalesGoal({ sold: 0, presentations: 0, doors: 0, activeDays: 0 })).toEqual({
      goal: STARTER_DAILY_SALES_GOAL,
      basis: "starter",
    });
  });

  it("counts DISTINCT WORKING DAYS, not the window length", () => {
    // A rep who worked 5 days of the last 30 must not be divided by 30. Same
    // sales, different divisor, and the goal must follow the days they worked.
    const worked5 = deriveDailySalesGoal({ sold: 10, presentations: 60, doors: 400, activeDays: 5 });
    const worked30 = deriveDailySalesGoal({ sold: 10, presentations: 60, doors: 400, activeDays: 30 });
    expect(worked5.goal).toBe(2);
    expect(worked30.goal).toBe(1);
  });

  it("never returns zero, and never rounds a rep's day down", () => {
    // 1.2 a day rounds UP to 2. Rounding down quietly lowers the target, and a
    // goal of 0 is not a goal at all.
    expect(deriveDailySalesGoal({ sold: 6, presentations: 50, doors: 400, activeDays: 5 }).goal).toBe(2);
    expect(deriveDailySalesGoal({ sold: 1, presentations: 9, doors: 40, activeDays: 30 }).goal).toBe(1);
    expect(deriveDailySalesGoal({ sold: 0, presentations: 0, doors: 1, activeDays: 30 }).goal).toBe(1);
  });

  it("refuses to ask a machine-sized number of a person", () => {
    // A freak window must not produce "sell 40 today". A human may still set
    // more deliberately; the derivation will not.
    const r = deriveDailySalesGoal({ sold: 400, presentations: 900, doors: 5000, activeDays: 1 });
    expect(r.goal).toBe(DERIVED_GOAL_CEILING);
  });

  it("survives nonsense counts without producing a nonsense goal", () => {
    for (const bad of [
      { sold: -5, presentations: 0, doors: -3, activeDays: -2 },
      { sold: Number.NaN, presentations: 0, doors: Number.NaN, activeDays: Number.NaN },
    ]) {
      const r = deriveDailySalesGoal(bad as never);
      expect(r.goal).toBeGreaterThanOrEqual(1);
      expect(r.goal).toBeLessThanOrEqual(DERIVED_GOAL_CEILING);
    }
  });
});

describe("goalBasisSentence", () => {
  it("tells the rep where their number came from, in every case", () => {
    // A figure with no visible derivation is indistinguishable from one somebody
    // guessed, and this app's whole argument is that it does not guess.
    for (const basis of ["own-sales", "own-activity", "starter"] as const) {
      const line = goalBasisSentence(basis, 2);
      expect(line.length).toBeGreaterThan(0);
      expect(line).toMatch(/2 sales/);
      expect(line).not.toMatch(/error|failed|cannot/i);
    }
  });

  it("says one sale, not 1 sales", () => {
    expect(goalBasisSentence("own-sales", 1)).toMatch(/1 sale a day/);
  });
});
