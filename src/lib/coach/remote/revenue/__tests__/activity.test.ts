import { describe, it, expect } from "vitest";
import { activityLevel, activityScore } from "../activity";

/** Account activity level (0375; Gong F21.4; the formula is ours, plan R5). */
const T = "2026-11-27";
describe("activity", () => {
  it("no two-way calls is inactive; one in every quarter of the window scores 50 (high)", () => {
    expect(activityLevel(activityScore([], T, 90))).toBe("inactive");
    expect(activityScore(["2026-11-20T12:00:00Z", "2026-10-30T12:00:00Z", "2026-10-07T12:00:00Z", "2026-09-15T12:00:00Z"], T, 90)).toBe(50);
  });
  it("recent counts more than old; more calls add less each (diminishing returns)", () => {
    expect(activityScore(["2026-11-25T12:00:00Z"], T, 90)).toBeGreaterThan(activityScore(["2026-09-05T12:00:00Z"], T, 90));
    const one = activityScore(["2026-11-25T12:00:00Z"], T, 90);
    const two = activityScore(["2026-11-25T12:00:00Z", "2026-11-24T12:00:00Z"], T, 90);
    const three = activityScore(["2026-11-25T12:00:00Z", "2026-11-24T12:00:00Z", "2026-11-23T12:00:00Z"], T, 90);
    expect(two - one).toBeGreaterThan(three - two);
  });
  it("calls outside the window don't count", () => {
    expect(activityScore(["2026-01-01T12:00:00Z"], T, 90)).toBe(0);
  });
  it("levels", () => {
    expect(activityLevel(60)).toBe("high");
    expect(activityLevel(30)).toBe("medium");
    expect(activityLevel(5)).toBe("low");
  });
});
