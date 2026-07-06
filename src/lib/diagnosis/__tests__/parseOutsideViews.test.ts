import { describe, expect, it } from "vitest";
import { parseOutsideViews } from "../parseOutsideViews";

const reading = (over: Record<string, unknown> = {}) => ({
  framing: "someone with no stake sees X",
  whatItChallenges: "the assumption that Y",
  ifTrueThen: "then Z would differ",
  ...over,
});

/**
 * §1.3 outside-view parse. §3.4: a reading is surfaced only if it has all three
 * parts; malformed items are dropped, malformed output degrades to [].
 */
describe("parseOutsideViews", () => {
  it("keeps a fully-formed reading", () => {
    const out = parseOutsideViews(JSON.stringify({ readings: [reading()] }), 3);
    expect(out).toHaveLength(1);
    expect(out[0]!.framing).toContain("no stake");
  });

  it("DROPS a reading missing any of its three parts (§3.4 — no blank fields)", () => {
    const out = parseOutsideViews(
      JSON.stringify({
        readings: [
          reading({ ifTrueThen: "" }), // missing one part
          reading({ whatItChallenges: 42 }), // wrong type
          reading(), // valid
        ],
      }),
      5
    );
    expect(out).toHaveLength(1);
  });

  it("caps at count (keeps the first `count` valid readings)", () => {
    const out = parseOutsideViews(
      JSON.stringify({ readings: [reading(), reading(), reading(), reading()] }),
      2
    );
    expect(out).toHaveLength(2);
  });

  it("malformed JSON → []", () => {
    expect(parseOutsideViews("not json", 3)).toEqual([]);
  });

  it("non-array readings → []", () => {
    expect(parseOutsideViews(JSON.stringify({ readings: "nope" }), 3)).toEqual([]);
    expect(parseOutsideViews(JSON.stringify({}), 3)).toEqual([]);
    expect(parseOutsideViews(JSON.stringify(42), 3)).toEqual([]);
  });

  it("skips non-object items without crashing", () => {
    const out = parseOutsideViews(
      JSON.stringify({ readings: [null, "x", 7, reading()] }),
      5
    );
    expect(out).toHaveLength(1);
  });
});
