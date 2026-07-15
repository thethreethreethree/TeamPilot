import { describe, it, expect } from "vitest";

/**
 * REFERENCE SPEC for migration 0176 (fin_break_even — break-even revenue + THE REFUSAL).
 *
 * The SQL view fin_break_even is source-of-truth; this mirrors its break_even_revenue and
 * reason logic in JS so the correctness-critical REFUSAL is pinned without a live DB.
 *
 * The bug it guards (named in the 0176 header): break-even = fixed_cost ÷ contribution-ratio.
 * When contribution margin is ZERO or NEGATIVE, the formula still divides and hands back a
 * number — a *negative* break-even that looks like a small achievable target. The truth is the
 * opposite: at a non-positive contribution margin THERE IS NO VOLUME THAT BREAKS EVEN; every
 * additional sale increases the loss. The view returns NULL (not a number) in exactly those
 * cases. This test locks that refusal — the whole point of the migration — against a future
 * "simplification" of the CASE that would divide unconditionally.
 */

type BreakEven = { breakEven: number | null; ratio: number | null; reason: string | null };

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Mirror of the SQL view's per-row computation. */
function breakEven(revenue: number, variableCost: number, fixedCost: number): BreakEven {
  const contribution = revenue - variableCost;

  // ratio: NULL when no revenue ("nothing per nothing" is undefined, not 0).
  const ratio = revenue > 0 ? round(contribution / revenue, 6) : null;

  // THE REFUSAL: only defined when each sale contributes something toward fixed costs.
  const be =
    revenue > 0 && contribution > 0
      ? round(fixedCost / (contribution / revenue), 2)
      : null;

  // the words that explain a NULL, mirroring the SQL CASE order (revenue=0 first).
  const reason =
    revenue === 0
      ? "no-revenue"
      : contribution <= 0
        ? "no-break-even-volume"
        : null;

  return { breakEven: be, ratio, reason };
}

describe("break-even refusal (migration 0176 reference)", () => {
  it("healthy margin: fixed ÷ contribution-ratio gives the break-even revenue", () => {
    // revenue 1000, variable 400 → ratio 0.6; fixed 3000 → break-even 5000.
    const r = breakEven(1000, 400, 3000);
    expect(r.ratio).toBe(0.6);
    expect(r.breakEven).toBe(5000);
    expect(r.reason).toBeNull();
  });

  it("THE TRAP — negative contribution returns NULL, never a (misleading) negative target", () => {
    // revenue 1000, variable 1200 → contribution -200. A naive fixed/ratio = 3000/-0.2 = -15000,
    // which reads as "you only need -£15k of revenue" — nonsense. The view refuses.
    const r = breakEven(1000, 1200, 3000);
    expect(r.breakEven).toBeNull(); // refused — NOT the -15000 a naive fixed/ratio would return
    expect(r.reason).toBe("no-break-even-volume");
  });

  it("zero contribution (revenue == variable) returns NULL, not infinity", () => {
    const r = breakEven(1000, 1000, 3000); // contribution 0 → divide-by-zero territory
    expect(r.breakEven).toBeNull();
    expect(r.reason).toBe("no-break-even-volume");
  });

  it("zero revenue returns NULL ratio AND NULL break-even (undefined, not 0)", () => {
    const r = breakEven(0, 0, 3000);
    expect(r.ratio).toBeNull();
    expect(r.breakEven).toBeNull();
    expect(r.reason).toBe("no-revenue");
  });

  it("zero revenue with cost still refuses (no division by a zero/absent ratio)", () => {
    const r = breakEven(0, 500, 3000);
    expect(r.breakEven).toBeNull();
    expect(r.reason).toBe("no-revenue"); // revenue=0 branch wins first, matching SQL CASE order
  });

  it("thin-but-positive margin computes a (large) finite break-even, never NULL", () => {
    // revenue 1000, variable 990 → contribution 10, ratio 0.01; fixed 3000 → break-even 300000.
    const r = breakEven(1000, 990, 3000);
    expect(r.ratio).toBe(0.01);
    expect(r.breakEven).toBe(300000);
    expect(r.reason).toBeNull();
  });

  it("INVARIANT: break_even is NULL if and only if the reason is non-null (refusal ⇔ explanation)", () => {
    const shapes: Array<[number, number, number]> = [
      [1000, 400, 3000], [1000, 1200, 3000], [1000, 1000, 3000],
      [0, 0, 3000], [0, 500, 3000], [1000, 990, 3000], [500, 500, 0], [750, 300, 1200],
    ];
    for (const [rev, vc, fc] of shapes) {
      const r = breakEven(rev, vc, fc);
      // a refusal always carries words; a number never does. The surface never has to guess.
      expect(r.breakEven === null).toBe(r.reason !== null);
    }
  });
});
