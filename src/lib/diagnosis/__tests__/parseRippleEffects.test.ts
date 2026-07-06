import { describe, expect, it } from "vitest";
import { parseRippleEffects } from "../parseRippleEffects";

const ripple = (over: Record<string, unknown> = {}) => ({
  affectedSubject: "task:abc",
  effect: "it slips a week",
  confidence: "medium",
  reasoning: "because it depends on the same person",
  ...over,
});

/**
 * §1.5 ripple-trace parse. Rule 2: every effect must carry its WHY (reasoning),
 * else it is not a valid ripple. §3.4: malformed output degrades to [].
 */
describe("parseRippleEffects", () => {
  it("keeps a fully-formed ripple", () => {
    const out = parseRippleEffects(JSON.stringify({ ripples: [ripple()] }));
    expect(out).toHaveLength(1);
    expect(out[0]!.confidence).toBe("medium");
  });

  it("DROPS a ripple with no reasoning (Rule 2 — the WHY is mandatory)", () => {
    const out = parseRippleEffects(
      JSON.stringify({ ripples: [ripple({ reasoning: "" }), ripple()] })
    );
    expect(out).toHaveLength(1);
  });

  it("DROPS a ripple missing subject or effect", () => {
    const out = parseRippleEffects(
      JSON.stringify({
        ripples: [ripple({ affectedSubject: "" }), ripple({ effect: "  " })],
      })
    );
    expect(out).toEqual([]);
  });

  it("defaults an unrecognized confidence to the conservative 'low'", () => {
    const out = parseRippleEffects(
      JSON.stringify({ ripples: [ripple({ confidence: "certain" }), ripple({ confidence: 5 })] })
    );
    expect(out.every((r) => r.confidence === "low")).toBe(true);
  });

  it("malformed JSON → [] and non-array ripples → []", () => {
    expect(parseRippleEffects("{{")).toEqual([]);
    expect(parseRippleEffects(JSON.stringify({ ripples: "no" }))).toEqual([]);
    expect(parseRippleEffects(JSON.stringify({}))).toEqual([]);
  });

  it("skips non-object items without crashing", () => {
    const out = parseRippleEffects(
      JSON.stringify({ ripples: [null, "x", 3, ripple()] })
    );
    expect(out).toHaveLength(1);
  });
});
