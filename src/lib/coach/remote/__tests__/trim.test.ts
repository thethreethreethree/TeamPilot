import { describe, it, expect } from "vitest";
import { activeTrims, skipTo, TrimError, validateTrim } from "../trim";

describe("validateTrim", () => {
  it("accepts a section of at least a second inside the call", () => {
    expect(() => validateTrim(5000, 9000, 60_000)).not.toThrow();
    expect(() => validateTrim(5000, 9000, null)).not.toThrow(); // length unknown: no upper check
  });
  it("refuses negative, too short, fractional, or past-the-end sections", () => {
    for (const [a, b, len] of [[-1, 5000, 60_000], [0, 999, 60_000], [0.5, 5000, 60_000], [60_000, 61_000, 60_000], [NaN, 5000, null]] as const) {
      expect(() => validateTrim(a, b, len)).toThrow(TrimError);
    }
  });
});

describe("activeTrims / skipTo", () => {
  const T = (id: string, s: number, e: number) => ({ id, start_ms: s, end_ms: e, created_at: "", trimmed_by: "m" });
  it("drops restored trims and sorts by start", () => {
    expect(activeTrims([T("b", 9000, 12_000), T("a", 1000, 3000), T("c", 5000, 6000)], ["c"]).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("playback inside a trim jumps to its end; chained trims jump past all of them", () => {
    const act = [T("a", 1000, 3000), T("b", 3000, 5000)];
    expect(skipTo(500, act)).toBeNull();
    expect(skipTo(1000, act)).toBe(5000);
    expect(skipTo(4000, act)).toBe(5000);
    expect(skipTo(5000, act)).toBeNull();
  });
});
