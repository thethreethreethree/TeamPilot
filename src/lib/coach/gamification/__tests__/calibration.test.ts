import { describe, it, expect } from "vitest";
import { computeCalibration, CALIBRATION_THRESHOLD } from "../calibration";

describe("computeCalibration", () => {
  it("perfect agreement → 0 mean diff, every dimension trustworthy", () => {
    const r = computeCalibration([
      { sessionId: "s1", human: { opener: 7, close: 5 }, model: { opener: 7, close: 5 } },
      { sessionId: "s2", human: { opener: 8, close: 6 }, model: { opener: 8, close: 6 } },
    ]);
    expect(r.n).toBe(2);
    expect(r.perDimension.find((d) => d.dimension === "opener")!.meanAbsDiff).toBe(0);
    expect(r.perDimension.find((d) => d.dimension === "opener")!.trustworthy).toBe(true);
    expect(r.overallTrustworthy).toBe(true);
  });

  it("flags a dimension whose mean abs diff exceeds the threshold as untrustworthy", () => {
    // opener diffs: |7-4|=3, |8-5|=3 → mean 3 > 1.5 → untrustworthy
    const r = computeCalibration([
      { sessionId: "s1", human: { opener: 7 }, model: { opener: 4 } },
      { sessionId: "s2", human: { opener: 8 }, model: { opener: 5 } },
    ]);
    const opener = r.perDimension.find((d) => d.dimension === "opener")!;
    expect(opener.meanAbsDiff).toBe(3);
    expect(opener.trustworthy).toBe(false);
    expect(r.overallTrustworthy).toBe(false); // one bad dimension makes the whole not-yet-trustworthy
    expect(CALIBRATION_THRESHOLD).toBe(1.5);
  });

  it("a diff exactly at the threshold is still trustworthy (<=)", () => {
    const r = computeCalibration([{ sessionId: "s1", human: { tone: 7 }, model: { tone: 8.5 } }]);
    // |7-8.5| = 1.5 → at the threshold → trustworthy
    expect(r.perDimension.find((d) => d.dimension === "tone")!.trustworthy).toBe(true);
  });

  it("only counts a dimension when BOTH sides scored it", () => {
    const r = computeCalibration([{ sessionId: "s1", human: { opener: 7 }, model: { close: 5 } }]);
    expect(r.perDimension.find((d) => d.dimension === "opener")!.n).toBe(0);
    expect(r.perDimension.find((d) => d.dimension === "opener")!.trustworthy).toBeNull();
    expect(r.n).toBe(0);
  });

  it("surfaces the worst disagreements, largest first", () => {
    const r = computeCalibration([
      { sessionId: "s1", human: { opener: 9 }, model: { opener: 2 } }, // diff 7
      { sessionId: "s2", human: { close: 6 }, model: { close: 5 } }, // diff 1
      { sessionId: "s3", human: { tone: 8 }, model: { tone: 3 } }, // diff 5
    ]);
    expect(r.worstDisagreements[0]).toMatchObject({ sessionId: "s1", diff: 7 });
    expect(r.worstDisagreements[1]).toMatchObject({ sessionId: "s3", diff: 5 });
  });

  it("empty input → no data, overall null (not a fabricated verdict)", () => {
    const r = computeCalibration([]);
    expect(r.n).toBe(0);
    expect(r.overallTrustworthy).toBeNull();
  });
});
