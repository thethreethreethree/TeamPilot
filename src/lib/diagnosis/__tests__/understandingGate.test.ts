import { describe, expect, it } from "vitest";
import {
  evaluateUnderstandingGate,
  describeGapToGate,
  DEFAULT_THRESHOLD,
} from "../understandingGate";

const longDiagnosis =
  // 80 chars exactly is the cutoff, so produce something safely above.
  "This is a well-articulated WHY that explains the root cause in detail with enough context.";

describe("evaluateUnderstandingGate", () => {
  it("passes when ≥3 signals, ≥2 distinct sources, and ≥80 chars of diagnosis", () => {
    const result = evaluateUnderstandingGate({
      signalCount: 3,
      distinctSources: ["a", "b"],
      diagnosis: longDiagnosis,
    });
    expect(result.passes).toBe(true);
    expect(result.threshold).toEqual(DEFAULT_THRESHOLD);
    expect(result.reason).toMatch(/Gate passes/);
  });

  it("fails when signalCount < 3 and the reason mentions the signal deficit", () => {
    const result = evaluateUnderstandingGate({
      signalCount: 2,
      distinctSources: ["a", "b"],
      diagnosis: longDiagnosis,
    });
    expect(result.passes).toBe(false);
    expect(result.reason).toContain("signals");
    expect(result.reason).toContain("2");
  });

  it("fails when fewer than 2 distinct sources", () => {
    const result = evaluateUnderstandingGate({
      signalCount: 5,
      distinctSources: ["a", "a", "a"],
      diagnosis: longDiagnosis,
    });
    expect(result.passes).toBe(false);
    expect(result.reason).toContain("distinct sources");
    expect(result.distinctSourceCount).toBe(1);
  });

  it("fails when diagnosis has fewer than 80 chars", () => {
    const result = evaluateUnderstandingGate({
      signalCount: 5,
      distinctSources: ["a", "b"],
      diagnosis: "too short",
    });
    expect(result.passes).toBe(false);
    expect(result.reason).toContain("diagnosis");
  });

  it("combines multiple failure modes into the reason string", () => {
    const result = evaluateUnderstandingGate({
      signalCount: 1,
      distinctSources: ["a"],
      diagnosis: "short",
    });
    expect(result.passes).toBe(false);
    expect(result.reason).toContain("signals");
    expect(result.reason).toContain("distinct sources");
    expect(result.reason).toContain("diagnosis");
  });

  it("respects a custom threshold override", () => {
    const result = evaluateUnderstandingGate({
      signalCount: 1,
      distinctSources: ["a"],
      diagnosis: "x",
      threshold: { minSignals: 1, minDistinctSources: 1, minDiagnosisChars: 1 },
    });
    expect(result.passes).toBe(true);
    expect(result.threshold.minSignals).toBe(1);
  });
});

describe("describeGapToGate", () => {
  it("returns an empty string when the gate passes", () => {
    const ev = evaluateUnderstandingGate({
      signalCount: 3,
      distinctSources: ["a", "b"],
      diagnosis: longDiagnosis,
    });
    expect(describeGapToGate(ev)).toBe("");
  });

  it("lists each specific deficit when the gate holds", () => {
    const ev = evaluateUnderstandingGate({
      signalCount: 1,
      distinctSources: ["a"],
      diagnosis: "short",
    });
    const gap = describeGapToGate(ev);
    expect(gap).toContain("signal");
    expect(gap).toContain("distinct source");
    expect(gap).toContain("chars");
  });
});
