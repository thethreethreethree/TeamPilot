import { describe, it, expect } from "vitest";
import { BANDS, POINTS_SCALE_MAX, STRONG_SESSION_THRESHOLD, POINTS_DIMENSIONS, RUBRIC_VERSION } from "../rubric";

/**
 * Config sanity for the gamification points constants (Phase 1). These are the single source for the scale +
 * bands + threshold; a gap or overlap in the bands would misclassify a session, so lock the invariants.
 */
describe("gamification rubric config", () => {
  it("bands cover 0..POINTS_SCALE_MAX contiguously with no gap or overlap", () => {
    const ascending = [...BANDS].sort((a, b) => a.min - b.min);
    expect(ascending[0]!.min).toBe(0);
    expect(ascending[ascending.length - 1]!.max).toBe(POINTS_SCALE_MAX);
    for (let i = 1; i < ascending.length; i++) {
      // each band starts exactly one above the previous band's max — contiguous, no gap, no overlap.
      expect(ascending[i]!.min).toBe(ascending[i - 1]!.max + 1);
    }
  });

  it("the strong-session alert threshold sits at the bottom of the 'strong' band", () => {
    const strong = BANDS.find((b) => b.band === "strong");
    expect(strong).toBeTruthy();
    expect(STRONG_SESSION_THRESHOLD).toBe(strong!.min);
  });

  it("every point is classifiable into exactly one band", () => {
    for (let n = 0; n <= POINTS_SCALE_MAX; n++) {
      const matches = BANDS.filter((b) => n >= b.min && n <= b.max);
      expect(matches).toHaveLength(1);
    }
  });

  it("points dimensions reuse the existing scorer keys and are non-empty", () => {
    expect(POINTS_DIMENSIONS.length).toBeGreaterThan(0);
    // reuse, not invention: these must be a subset of the existing after-pitch ScoreKeys.
    const existingKeys = ["opener", "objection", "talk_ratio", "question_rate", "tone", "close", "next_step"];
    for (const d of POINTS_DIMENSIONS) expect(existingKeys).toContain(d);
  });

  it("rubric version is stamped", () => {
    expect(RUBRIC_VERSION).toBe("v1");
  });
});
