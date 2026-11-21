import { describe, it, expect } from "vitest";
import { measuredEndedAt } from "../liveTiming";

describe("measuredEndedAt", () => {
  const at = "2026-11-20T10:00:05.000Z";
  it("start + the measured span of the spoken words (spacing items ignored), whatever the words' reference point", () => {
    const words = [{ text: "hi", start: 312.4, end: 312.7, type: "word" }, { text: " ", start: 312.7, end: 312.8, type: "spacing" }, { text: "there", start: 312.8, end: 314.9, type: "word" }];
    expect(measuredEndedAt(at, words)).toBe("2026-11-20T10:00:07.500Z");
  });
  it("null when it can't be measured: no start, no words, zero/negative span, or an absurd one", () => {
    expect(measuredEndedAt(null, [{ start: 1, end: 2 }])).toBeNull();
    expect(measuredEndedAt(at, null)).toBeNull();
    expect(measuredEndedAt(at, [])).toBeNull();
    expect(measuredEndedAt(at, [{ start: 5, end: 5 }])).toBeNull();
    expect(measuredEndedAt(at, [{ start: 0, end: 900 }])).toBeNull();
    expect(measuredEndedAt(at, [{ start: "x", end: 2 }])).toBeNull();
  });
});
