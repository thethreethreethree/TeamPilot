import { describe, it, expect } from "vitest";
import { periodStartLocal, averageScores, isMetricsPeriod } from "../period";

/**
 * Guards for the Today's-Metrics period windowing + score aggregation (founder spec 2026-08-19). The windows
 * must match the rollup's (so metrics + patterns describe the same doors), and averaging must skip missing dims
 * so a period mixing the v1 and v2 rubrics isn't diluted with phantom zeros.
 */
describe("periodStartLocal", () => {
  it("day = today, week = 6 days back, month = 29 days back, all_time = null", () => {
    expect(periodStartLocal("day", "2026-08-19")).toBe("2026-08-19");
    expect(periodStartLocal("week", "2026-08-19")).toBe("2026-08-13");
    expect(periodStartLocal("month", "2026-08-19")).toBe("2026-07-21");
    expect(periodStartLocal("all_time", "2026-08-19")).toBeNull();
  });
});

describe("averageScores", () => {
  it("averages each dim over the pitches that carry it (rounded), skipping absent dims", () => {
    const avg = averageScores([
      { objection: 80, tone: 60, close: 70 },
      { objection: 90, tone: 70, close: 80, questions: 50 },
    ]);
    expect(avg.objection).toBe(85); // (80+90)/2
    expect(avg.tone).toBe(65);
    expect(avg.close).toBe(75);
    expect(avg.questions).toBe(50); // only present on one pitch → averaged over 1, not diluted by a phantom 0
  });

  it("mixed v1/v2 rubric pitches: each dim averages only over the pitches that have it", () => {
    const avg = averageScores([
      { opener: 40, objection: 60, tone: 50, close: 55 }, // v1
      { objection: 80, talk_listen: 70, questions: 90, tone: 60, close: 65 }, // v2
    ]);
    expect(avg.opener).toBe(40); // v1-only
    expect(avg.talk_listen).toBe(70); // v2-only
    expect(avg.objection).toBe(70); // both → (60+80)/2
  });

  it("returns {} for no input (caller shows an honest empty)", () => {
    expect(averageScores([])).toEqual({});
  });
});

describe("isMetricsPeriod", () => {
  it("accepts the four valid periods, rejects junk", () => {
    expect(isMetricsPeriod("week")).toBe(true);
    expect(isMetricsPeriod("all_time")).toBe(true);
    expect(isMetricsPeriod("year")).toBe(false);
  });
});
