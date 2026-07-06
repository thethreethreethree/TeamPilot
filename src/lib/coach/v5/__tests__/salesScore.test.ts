import { describe, expect, it } from "vitest";
import { parseGraded } from "../salesScore";

const cat = (over: Record<string, unknown> = {}) => ({
  key: "opener",
  score: 7,
  rationale: "strong, warm open",
  ...over,
});

/**
 * parseGraded is the §3.5 / A11 measurement guard: scores are clamped to [0,10],
 * only known categories count, and a score with no rationale is dropped (a
 * number the rep can't inspect is a naked verdict).
 */
describe("parseGraded — measurement honesty", () => {
  it("keeps a well-formed, rationale-backed score", () => {
    const out = parseGraded(JSON.stringify({ categories: [cat()] }));
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe("opener");
    expect(out[0]!.score).toBe(7);
    expect(out[0]!.display).toBe("7/10");
  });

  it("A11: DROPS a score with no rationale (never a naked verdict)", () => {
    const out = parseGraded(
      JSON.stringify({
        categories: [cat({ key: "tone", rationale: "" }), cat({ key: "close" })],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe("close");
  });

  it("clamps scores to [0,10] and rounds", () => {
    const out = parseGraded(
      JSON.stringify({
        categories: [
          cat({ key: "opener", score: 15 }),
          cat({ key: "objection", score: -4 }),
          cat({ key: "tone", score: 7.6 }),
        ],
      })
    );
    const byKey = Object.fromEntries(out.map((c) => [c.key, c.score]));
    expect(byKey.opener).toBe(10);
    expect(byKey.objection).toBe(0);
    expect(byKey.tone).toBe(8);
  });

  it("drops an unknown category key", () => {
    const out = parseGraded(
      JSON.stringify({ categories: [cat({ key: "vibes" }), cat({ key: "close" })] })
    );
    expect(out.map((c) => c.key)).toEqual(["close"]);
  });

  it("drops a non-numeric score", () => {
    const out = parseGraded(
      JSON.stringify({ categories: [cat({ key: "opener", score: "high" })] })
    );
    expect(out).toHaveLength(0);
  });

  it("hasSignal:false or malformed → empty list", () => {
    expect(parseGraded(JSON.stringify({ hasSignal: false, categories: [cat()] }))).toEqual([]);
    expect(parseGraded("not json")).toEqual([]);
  });
});
