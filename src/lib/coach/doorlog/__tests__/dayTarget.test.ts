import { describe, it, expect } from "vitest";
import {
  calculateDayTarget,
  dialFill,
  DOORS_FLOOR,
  DOORS_CEILING,
} from "../dayTarget";

/**
 * Day-target engine (Phase 05 / verified per Phase 09). The screen's whole claim is that the numbers are
 * right, so these assert the chosen behaviour for every case in 05-target-engine.md — not just "doesn't throw".
 */

describe("calculateDayTarget — the worked example (03-number-logic.md)", () => {
  it("goal 2, close 1/9, contact 1/4.4, qualified → 18 presentations, 80 doors (rounds UP; 79.2 → 80)", () => {
    const t = calculateDayTarget({ salesGoal: 2, closeRatio: 1 / 9, contactRatio: 1 / 4.4, qualified: true });
    expect(t.soldTarget).toBe(2);
    expect(t.presentationsTarget).toBe(18);
    expect(t.doorsTarget).toBe(80); // if this is 79, rounding is wrong
    expect(t.usedStarter).toBe(false);
  });
});

describe("calculateDayTarget — the starter fallback (new / thin history)", () => {
  it("unqualified rep uses the starter ratios → same 18 / 80 for goal 2, flagged usedStarter", () => {
    const t = calculateDayTarget({ salesGoal: 2, closeRatio: null, contactRatio: null, qualified: false });
    expect(t.presentationsTarget).toBe(18);
    expect(t.doorsTarget).toBe(80);
    expect(t.usedStarter).toBe(true);
  });

  it("ZERO sales in the window (closeRatio 0) never divides by zero — falls back to the starter", () => {
    const t = calculateDayTarget({ salesGoal: 2, closeRatio: 0, contactRatio: 1 / 4.4, qualified: true });
    expect(Number.isFinite(t.doorsTarget)).toBe(true);
    expect(t.doorsTarget).toBe(80); // starter, not Infinity
    expect(t.usedStarter).toBe(true);
  });

  it("ZERO doors in the window (contactRatio null) → starter, no crash", () => {
    const t = calculateDayTarget({ salesGoal: 2, closeRatio: 1 / 9, contactRatio: null, qualified: true });
    expect(t.doorsTarget).toBe(80);
    expect(t.usedStarter).toBe(true);
  });
});

describe("calculateDayTarget — floor, ceiling, and absurd ratios", () => {
  it("an absurd-easy ratio clamps UP to the floor (a 2-door target is useless)", () => {
    const t = calculateDayTarget({ salesGoal: 2, closeRatio: 1, contactRatio: 1, qualified: true });
    expect(t.doorsTarget).toBe(DOORS_FLOOR); // raw 2 → floored to 20
  });

  it("an absurd-hard ratio clamps DOWN to the ceiling (a 1000-door target is useless)", () => {
    const t = calculateDayTarget({ salesGoal: 2, closeRatio: 1 / 50, contactRatio: 1 / 10, qualified: true });
    expect(t.doorsTarget).toBe(DOORS_CEILING); // raw 1000 → capped at 200
  });
});

describe("calculateDayTarget — no real goal", () => {
  it("a non-positive goal yields all-zero targets, not a fabricated number", () => {
    expect(calculateDayTarget({ salesGoal: 0, closeRatio: 1 / 9, contactRatio: 1 / 4.4, qualified: true }))
      .toEqual({ doorsTarget: 0, presentationsTarget: 0, soldTarget: 0, usedStarter: true });
  });
});

describe("dialFill — clamps overshoot, empty ring on no target", () => {
  it("47 of 80 is 0.5875", () => expect(dialFill(47, 80)).toBeCloseTo(0.5875, 4));
  it("95 of 80 clamps at 1 (full ring, no second lap)", () => expect(dialFill(95, 80)).toBe(1));
  it("a zero/absent target is an empty ring, not a divide-by-zero", () => {
    expect(dialFill(3, 0)).toBe(0);
    expect(dialFill(0, 0)).toBe(0);
  });
});
