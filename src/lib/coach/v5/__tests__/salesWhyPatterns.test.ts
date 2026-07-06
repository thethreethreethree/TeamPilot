import { describe, expect, it } from "vitest";
import { parsePatterns } from "../salesWhyPatterns";

/**
 * parsePatterns is the §3.5 / §3.4 guard on the why→outcome pattern engine.
 * These pin the invariants: an outcome-less "pattern" is noise and must be
 * dropped; malformed model output degrades honestly, never crashes.
 */
describe("parsePatterns", () => {
  it("keeps a well-formed, outcome-linked pattern", () => {
    const out = parsePatterns(
      JSON.stringify({
        patterns: [
          {
            pattern: "opens with price before value",
            frequency: "in 4 of your last 7 calls",
            outcomeAssociation: "mostly on no-sale calls",
            kind: "growth",
          },
        ],
        note: "you tend to lead with price",
      })
    );
    expect(out).not.toBeNull();
    expect(out!.patterns).toHaveLength(1);
    expect(out!.patterns[0]!.kind).toBe("growth");
    expect(out!.note).toBe("you tend to lead with price");
  });

  it("DROPS a pattern with no outcomeAssociation (§3.5 — no outcome link = noise)", () => {
    const out = parsePatterns(
      JSON.stringify({
        patterns: [
          { pattern: "talks fast", frequency: "often", outcomeAssociation: "", kind: "growth" },
          { pattern: "builds rapport first", frequency: "always", outcomeAssociation: "on closes", kind: "strength" },
        ],
        note: "",
      })
    );
    expect(out!.patterns).toHaveLength(1);
    expect(out!.patterns[0]!.pattern).toBe("builds rapport first");
  });

  it("DROPS a pattern with an empty pattern string", () => {
    const out = parsePatterns(
      JSON.stringify({
        patterns: [{ pattern: "", frequency: "x", outcomeAssociation: "on no-sale", kind: "growth" }],
        note: "",
      })
    );
    expect(out!.patterns).toHaveLength(0);
  });

  it("defaults an unknown/absent kind to 'growth' (never fabricates a 'strength')", () => {
    const out = parsePatterns(
      JSON.stringify({
        patterns: [{ pattern: "p", outcomeAssociation: "o", kind: "wobbly" }],
        note: "",
      })
    );
    expect(out!.patterns[0]!.kind).toBe("growth");
  });

  it("returns null on malformed JSON (§3.4 — honest failure, no crash)", () => {
    expect(parsePatterns("not json {{{")).toBeNull();
  });

  it("returns null on a non-object top level", () => {
    expect(parsePatterns("42")).toBeNull();
  });

  it("tolerates a missing patterns array → empty list", () => {
    const out = parsePatterns(JSON.stringify({ note: "just a note" }));
    expect(out!.patterns).toEqual([]);
    expect(out!.note).toBe("just a note");
  });
});
