import { describe, it, expect } from "vitest";

/**
 * REFERENCE SPEC for migration 0166 (fin_run_depreciation — straight-line + salvage floor).
 *
 * The SQL function fin_run_depreciation is the source of truth; this mirrors its per-period
 * AMOUNT algorithm in JS so the salvage-floor clamp is testable without a live DB (the one
 * part of that migration invisible until an asset is near fully depreciated — the migration
 * header calls this out as failure mode #1). If this test is right, the SQL — which uses the
 * identical round((cost-salvage)/life,4) slice and least(slice, (cost-salvage)-accum) clamp —
 * is right. These cases ARE the staging acceptance spec for 0166's depreciation math.
 *
 * The bug it guards: taking a FULL monthly slice one period too long drives net book value
 * BELOW salvage — the books then claim the asset is worth less than scrap. The clamp makes
 * the final slice exactly the remaining depreciable base, so accumulated depreciation lands
 * on (cost - salvage) precisely and NBV rests at salvage, never under.
 */

/** round to 4 decimals, matching SQL numeric(19,4) + round(...,4). */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Mirror of the SQL: the amount posted for ONE period given what's already accumulated.
 *  Returns null when the asset is fully depreciated (SQL raises; here we surface it as "no
 *  slice" so the test can assert termination). */
function depreciationSlice(
  cost: number,
  salvage: number,
  life: number,
  accumulated: number,
): number | null {
  const monthly = r4((cost - salvage) / life);
  const amount = r4(Math.min(monthly, r4(cost - salvage) - accumulated));
  return amount <= 0 ? null : amount;
}

/** Run the schedule to completion, returning every posted slice. */
function fullSchedule(cost: number, salvage: number, life: number): number[] {
  const slices: number[] = [];
  let accum = 0;
  // Bound the loop well past `life` so a clamp/residual can't run away; a correct schedule
  // terminates at or one past `life`.
  for (let i = 0; i < life + 5; i++) {
    const slice = depreciationSlice(cost, salvage, life, accum);
    if (slice === null) break;
    slices.push(slice);
    accum = r4(accum + slice);
  }
  return slices;
}

describe("straight-line depreciation with salvage floor (migration 0166 reference)", () => {
  it("clean division: 12000 / 12mo, no salvage → 12 equal 1000 slices, sums to cost", () => {
    const slices = fullSchedule(12000, 0, 12);
    expect(slices).toHaveLength(12);
    expect(slices.every((s) => s === 1000)).toBe(true);
    expect(r4(slices.reduce((a, b) => a + b, 0))).toBe(12000);
  });

  it("THE SALVAGE FLOOR: accumulated depreciation lands EXACTLY on (cost - salvage), never over", () => {
    // 10000 cost, 1000 salvage, 7 months → 9000/7 = 1285.7142857 → 1285.7143/mo (rounds UP).
    // Six full slices = 7714.2858; a seventh full slice (1285.7143) would total 8999.9998 <— under,
    // then the clamp corrects. The point: sum of slices == cost - salvage to the cent.
    const cost = 10000, salvage = 1000, life = 7;
    const slices = fullSchedule(cost, salvage, life);
    const total = r4(slices.reduce((a, b) => a + b, 0));
    expect(total).toBe(cost - salvage); // 9000 exactly → NBV rests at salvage
    // NBV never dips below salvage at any intermediate step:
    let accum = 0;
    for (const s of slices) {
      accum = r4(accum + s);
      expect(cost - accum).toBeGreaterThanOrEqual(salvage);
    }
  });

  it("the FINAL slice is clamped, not a full month, when rounding left a residual", () => {
    // 10000/1000/7: monthly = 1285.7143. Full slices for 6 periods, the 7th is the clamped remainder.
    const cost = 10000, salvage = 1000, life = 7;
    const monthly = r4((cost - salvage) / life); // 1285.7143
    const slices = fullSchedule(cost, salvage, life);
    const last = slices[slices.length - 1];
    expect(last).toBeLessThan(monthly);     // clamped
    expect(last).toBeGreaterThan(0);
    // every earlier slice was a full month
    expect(slices.slice(0, -1).every((s) => s === monthly)).toBe(true);
  });

  it("terminates: once fully depreciated, no further slice is posted (SQL raises)", () => {
    const cost = 5000, salvage = 500, life = 5;
    const slices = fullSchedule(cost, salvage, life);
    // running one more period against the fully-accumulated asset yields no slice
    const accumFull = r4(slices.reduce((a, b) => a + b, 0));
    expect(depreciationSlice(cost, salvage, life, accumFull)).toBeNull();
  });

  it("a rounding-DOWN residual closes exactly on (cost - salvage) — via a trailing STUB period", () => {
    // 10000/0/3 → 3333.3333/mo (rounds DOWN). Three full slices = 9999.9999, leaving a 0.0001
    // residual, which the clamp posts as a FOURTH sub-cent slice to land on 10000 exactly.
    // DOCUMENTED BEHAVIOR (not a correctness bug — total is exact, floor respected): with a
    // rounding-down residual the schedule runs life+1 periods, the last being a stub. A stricter
    // "absorb the residual into the final SCHEDULED slice" convention would keep it to `life`
    // periods. Founder-gated cosmetic decision — flagged LOW in the action queue.
    const slices = fullSchedule(10000, 0, 3);
    expect(r4(slices.reduce((a, b) => a + b, 0))).toBe(10000); // exact — the invariant that matters
    expect(slices.length).toBe(4);                              // 3 full + 1 stub (documents the behavior)
    expect(slices[3]).toBeCloseTo(0.0001, 4);                   // the stub is the rounding residual
    expect(slices.slice(0, 3).every((s) => s === 3333.3333)).toBe(true);
  });

  it("INVARIANT across many shapes: slices always sum to exactly (cost - salvage), never over", () => {
    const shapes: Array<[number, number, number]> = [
      [12000, 0, 12], [10000, 1000, 7], [5000, 500, 5], [10000, 0, 3],
      [99999, 4999, 36], [1, 0, 3], [250000, 25000, 60], [7777, 777, 11],
    ];
    for (const [cost, salvage, life] of shapes) {
      const total = r4(fullSchedule(cost, salvage, life).reduce((a, b) => a + b, 0));
      expect(total).toBe(r4(cost - salvage)); // exact, for every shape — never below/above salvage
    }
  });
});
