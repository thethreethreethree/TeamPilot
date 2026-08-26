import { describe, it, expect } from "vitest";
import { parsePracticeReview } from "../route";

/**
 * Guard for the focus-seeded PRACTICE scorecard (founder 2026-08-26, "Roleplay + focus-scoring"). parsePracticeReview
 * reuses parseReview for the qualitative half (single-source honesty) and layers the scorecard. The honesty seams:
 * - a malformed/starved response → null (route 502s — never a blank scored card);
 * - applied:false is a VALID honest outcome, not a parse failure (the rep never got to the skill);
 * - score is clamped to 0-100 and rounded (an LLM can't emit an out-of-range or fractional grade);
 * - the focus echoed back is the one WE passed, never model-invented.
 */
describe("parsePracticeReview — scorecard honesty seams", () => {
  const FOCUS = "Handle the price objection before pitching value";

  it("returns null on malformed JSON so the route can 502 (no blank scored card)", () => {
    expect(parsePracticeReview("not json", FOCUS)).toBeNull();
    expect(parsePracticeReview("", FOCUS)).toBeNull();
  });

  it("returns null (not a crash) on valid-JSON-but-non-object responses (inherits the parseReview guard)", () => {
    expect(parsePracticeReview("null", FOCUS)).toBeNull();
    expect(parsePracticeReview("42", FOCUS)).toBeNull();
    expect(parsePracticeReview("[1,2]", FOCUS)).toBeNull();
  });

  it("parses a populated scored review and echoes OUR focus", () => {
    const r = parsePracticeReview(
      JSON.stringify({
        summary: "Strong on price",
        whatWorked: ["named the value first"],
        toImprove: ["ask sooner"],
        correctLine: null,
        applied: true,
        score: 82,
        nextRep: "Open with the value, then the price.",
      }),
      FOCUS,
    );
    expect(r).not.toBeNull();
    expect(r?.review.summary).toBe("Strong on price");
    expect(r?.scorecard.focus).toBe(FOCUS);
    expect(r?.scorecard.applied).toBe(true);
    expect(r?.scorecard.score).toBe(82);
    expect(r?.scorecard.nextRep).toBe("Open with the value, then the price.");
  });

  it("keeps applied:false as an honest outcome (skill never attempted), not a null", () => {
    const r = parsePracticeReview(
      JSON.stringify({ summary: "Too short to reach it", whatWorked: [], toImprove: [], correctLine: null, applied: false, score: 0, nextRep: "" }),
      FOCUS,
    );
    expect(r).not.toBeNull();
    expect(r?.scorecard.applied).toBe(false);
    expect(r?.scorecard.score).toBe(0);
  });

  it("clamps an out-of-range score and rounds a fractional one", () => {
    expect(parsePracticeReview(JSON.stringify({ summary: "x", whatWorked: [], toImprove: [], correctLine: null, applied: true, score: 140, nextRep: "" }), FOCUS)?.scorecard.score).toBe(100);
    expect(parsePracticeReview(JSON.stringify({ summary: "x", whatWorked: [], toImprove: [], correctLine: null, applied: true, score: -5, nextRep: "" }), FOCUS)?.scorecard.score).toBe(0);
    expect(parsePracticeReview(JSON.stringify({ summary: "x", whatWorked: [], toImprove: [], correctLine: null, applied: true, score: 73.6, nextRep: "" }), FOCUS)?.scorecard.score).toBe(74);
  });

  it("defaults a missing/non-numeric score to 0 and a missing nextRep to empty (no fabrication)", () => {
    const r = parsePracticeReview(
      JSON.stringify({ summary: "x", whatWorked: [], toImprove: [], correctLine: null, applied: true }),
      FOCUS,
    );
    expect(r?.scorecard.score).toBe(0);
    expect(r?.scorecard.nextRep).toBe("");
  });
});
