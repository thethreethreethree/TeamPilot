import { describe, it, expect } from "vitest";
import { parseReview } from "../route";

/**
 * Guard for the roleplay review honesty fix (audit 2026-08-19). A malformed/starved LLM response used to parse
 * into an all-empty review returned at HTTP 200 — a blank card indistinguishable from a legitimately-empty
 * "too short" review, while the sibling turn phase 502s on a parse failure. parseReview now returns null ONLY on
 * a real parse failure (route -> 502), and keeps a VALID-but-empty review (the honest "too short" case).
 */
describe("parseReview — parse failure is an error (null), valid-empty is kept", () => {
  it("returns null on malformed JSON (a starved/garbage response) so the route can 502", () => {
    expect(parseReview("not json at all")).toBeNull();
    expect(parseReview("")).toBeNull(); // empty (starvation) -> JSON.parse throws -> null
  });

  it("returns null (not a crash) on valid-JSON-but-non-object responses (audit 2026-08-26)", () => {
    // `JSON.parse("null") === null`; `o.correctLine` on null would throw an uncaught TypeError -> route 500 instead
    // of a clean 502. Also cover a bare number, string, boolean, and array.
    expect(parseReview("null")).toBeNull();
    expect(parseReview("42")).toBeNull();
    expect(parseReview('"a string"')).toBeNull();
    expect(parseReview("true")).toBeNull();
    expect(parseReview("[1,2,3]")).toBeNull();
  });

  it("keeps a VALID review with empty arrays (the legitimate 'too short' case, not an error)", () => {
    const r = parseReview(JSON.stringify({ summary: "", whatWorked: [], toImprove: [], correctLine: null }));
    expect(r).not.toBeNull();
    expect(r?.whatWorked).toEqual([]);
  });

  it("parses a populated review", () => {
    const r = parseReview(
      JSON.stringify({ summary: "Good open", whatWorked: ["rapport"], toImprove: ["close"], correctLine: { line: "Ask for the sale", why: "you earned it" } }),
    );
    expect(r?.summary).toBe("Good open");
    expect(r?.whatWorked).toEqual(["rapport"]);
    expect(r?.correctLine?.line).toBe("Ask for the sale");
  });
});
