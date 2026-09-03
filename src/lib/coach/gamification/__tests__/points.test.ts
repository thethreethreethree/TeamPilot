import { describe, it, expect } from "vitest";
import { computeSessionPoints, bandFor } from "../points";
import type { ScoreCategory, ScoreKey } from "@/lib/coach/v5/summaryTypes";

/** Minimal ScoreCategory factory — only the fields the mapping reads matter. */
const cat = (key: ScoreKey, score: number): ScoreCategory => ({
  key,
  label: key,
  score,
  display: `${score}/10`,
  rationale: "",
  citation: null,
  computed: false,
});

describe("computeSessionPoints (reuse the existing dimension scores → 0–100 points)", () => {
  it("points = round(mean of counted dimensions × 10)", () => {
    // mean of 8,6,7,5,4 = 6.0 → 60
    const r = computeSessionPoints([
      cat("opener", 8),
      cat("objection", 6),
      cat("tone", 7),
      cat("close", 5),
      cat("next_step", 4),
    ]);
    expect(r).not.toBeNull();
    expect(r!.points).toBe(60);
    expect(r!.band).toBe("solid");
    expect(r!.dimensions.opener).toBe(8);
  });

  it("rounds half-up", () => {
    // mean of 7,8 = 7.5 → ×10 = 75 (exact); mean of 7,7,8 = 7.333 → 73
    expect(computeSessionPoints([cat("opener", 7), cat("close", 8)])!.points).toBe(75);
    expect(computeSessionPoints([cat("opener", 7), cat("close", 7), cat("tone", 8)])!.points).toBe(73);
  });

  it("only POINTS_DIMENSIONS count; unknown keys are ignored", () => {
    const r = computeSessionPoints([
      cat("opener", 10),
      cat("weird_key" as ScoreKey, 0), // not a counted dimension — must not drag the mean to 5
    ]);
    expect(r!.points).toBe(100); // only opener counted
    expect(r!.band).toBe("elite");
  });

  it("returns null when no counted dimension is present (banks nothing, never a fabricated 0)", () => {
    expect(computeSessionPoints([])).toBeNull();
    expect(computeSessionPoints([cat("weird" as ScoreKey, 3)])).toBeNull();
  });

  it("ignores a non-finite / non-number score", () => {
    const r = computeSessionPoints([cat("opener", 6), cat("close", NaN as unknown as number)]);
    expect(r!.points).toBe(60); // only opener counted
  });

  it("bandFor maps totals to the right band at the boundaries", () => {
    expect(bandFor(90)).toBe("elite");
    expect(bandFor(89)).toBe("strong");
    expect(bandFor(80)).toBe("strong"); // manager-alert line
    expect(bandFor(79)).toBe("solid");
    expect(bandFor(40)).toBe("developing");
    expect(bandFor(39)).toBe("needs_coaching");
    expect(bandFor(0)).toBe("needs_coaching");
    expect(bandFor(100)).toBe("elite");
  });
});
