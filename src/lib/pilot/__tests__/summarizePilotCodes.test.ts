import { describe, it, expect } from "vitest";
import { summarizePilotCodes } from "../summarizePilotCodes";

const code = (module: string, redeemed: boolean) => ({
  module,
  redeemed_at: redeemed ? "2026-08-01T00:00:00Z" : null,
});

describe("summarizePilotCodes", () => {
  it("counts total / redeemed / available correctly (redeemed = has a redeemed_at)", () => {
    const s = summarizePilotCodes([
      code("care", true),
      code("care", false),
      code("sales_coach", true),
    ]);
    expect(s.total).toBe(3);
    expect(s.redeemed).toBe(2);
    expect(s.available).toBe(1);
    expect(s.redeemed + s.available).toBe(s.total); // the invariant that matters
  });

  it("breaks down per module (redeemed + available per module tie to that module's total)", () => {
    const s = summarizePilotCodes([
      code("sales_coach", true),
      code("sales_coach", false),
      code("sales_coach", false),
      code("care", true),
    ]);
    const sc = s.byModule.find((m) => m.module === "sales_coach")!;
    const care = s.byModule.find((m) => m.module === "care")!;
    expect(sc).toMatchObject({ total: 3, redeemed: 1, available: 2 });
    expect(care).toMatchObject({ total: 1, redeemed: 1, available: 0 });
  });

  it("orders known modules first, then any extras, and EXCLUDES modules with zero codes", () => {
    const s = summarizePilotCodes([code("care", false), code("elostate", false), code("mystery", false)]);
    // elostate is first in DEFAULT_MODULE_ORDER, care later; sales_coach has 0 codes so is excluded;
    // "mystery" (not in the order) still appears so a new module can't silently vanish.
    expect(s.byModule.map((m) => m.module)).toEqual(["elostate", "care", "mystery"]);
    expect(s.byModule.some((m) => m.module === "sales_coach")).toBe(false);
  });

  it("handles an empty list without NaN or a divide-by-zero shape", () => {
    const s = summarizePilotCodes([]);
    expect(s).toMatchObject({ total: 0, redeemed: 0, available: 0, byModule: [] });
  });

  it("treats an empty-string redeemed_at as NOT redeemed only if null (guards the truthiness choice)", () => {
    // redeemed_at is either an ISO string or null in practice; a present string = redeemed.
    expect(summarizePilotCodes([{ module: "care", redeemed_at: "2026-01-01T00:00:00Z" }]).redeemed).toBe(1);
    expect(summarizePilotCodes([{ module: "care", redeemed_at: null }]).redeemed).toBe(0);
  });
});
