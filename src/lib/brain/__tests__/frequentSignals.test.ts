import { describe, expect, it } from "vitest";
import {
  computeFrequentSignalKinds,
  FREQUENT_SIGNAL_MIN,
} from "../frequentSignals";

const rows = (spec: Record<string, number>) =>
  Object.entries(spec).flatMap(([kind, n]) =>
    Array.from({ length: n }, () => ({ kind }))
  );

/**
 * §4 evidence gate: the brain only treats a signal kind as a "known pattern"
 * once it recurs >= FREQUENT_SIGNAL_MIN times — never from thin evidence.
 */
describe("computeFrequentSignalKinds — §4 evidence gate", () => {
  it("includes a kind at exactly the threshold (>=5) and excludes below it", () => {
    const out = computeFrequentSignalKinds(rows({ a: 5, b: 4, c: 1 }));
    expect(out.map((x) => x.kind)).toEqual(["a"]); // b(4) and c(1) gated out
    expect(FREQUENT_SIGNAL_MIN).toBe(5);
  });

  it("NEVER surfaces a pattern from a single or handful of occurrences", () => {
    const out = computeFrequentSignalKinds(rows({ x: 1, y: 2, z: 3, w: 4 }));
    expect(out).toEqual([]); // all below the evidence gate
  });

  it("sorts by count descending", () => {
    const out = computeFrequentSignalKinds(rows({ low: 5, high: 12, mid: 8 }));
    expect(out.map((x) => x.kind)).toEqual(["high", "mid", "low"]);
  });

  it("caps at the top 10 most frequent", () => {
    const spec: Record<string, number> = {};
    for (let i = 0; i < 15; i++) spec[`k${i}`] = 5 + i; // all >= 5
    expect(computeFrequentSignalKinds(rows(spec))).toHaveLength(10);
  });

  it("empty input → empty", () => {
    expect(computeFrequentSignalKinds([])).toEqual([]);
  });
});
