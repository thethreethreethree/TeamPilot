import { describe, it, expect } from "vitest";
import { parsePitchAnalysis, parsePatternRollup } from "../analysisSchema";

/**
 * 5.7 — a malformed model response is REJECTED (→ null → retryable job failure), never persisted.
 */
describe("Macro Mode LLM contract", () => {
  it("accepts a well-formed per-pitch analysis", () => {
    const ok = parsePitchAnalysis({
      summary: "Opened with rapport, rushed the close.",
      strengths: ["warm open"],
      improvements: ["slow the close"],
      scores: { rapport: 82, discovery: 60, closing: 45 },
    });
    expect(ok).not.toBeNull();
    expect(ok?.scores.rapport).toBe(82);
  });

  it("rejects malformed analysis (missing summary, out-of-range score, non-array strengths)", () => {
    expect(parsePitchAnalysis({ strengths: [], improvements: [], scores: {} })).toBeNull(); // no summary
    expect(
      parsePitchAnalysis({ summary: "x", scores: { closing: 150 } }) // score > 100
    ).toBeNull();
    expect(
      parsePitchAnalysis({ summary: "x", strengths: "not-an-array" }) // wrong type
    ).toBeNull();
  });

  it("accepts a well-formed pattern rollup and rejects a bad trend direction", () => {
    expect(
      parsePatternRollup({
        headline: "Closing is improving week over week.",
        patterns_good: ["consistent discovery"],
        patterns_bad: ["still rushing price"],
        trend: { direction: "improving", note: "vs last week" },
      })
    ).not.toBeNull();
    expect(
      parsePatternRollup({
        headline: "x",
        trend: { direction: "up" }, // not one of improving|regressing|flat
      })
    ).toBeNull();
  });
});
