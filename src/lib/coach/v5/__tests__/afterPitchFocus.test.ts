import { describe, it, expect } from "vitest";
import { computeTalkRatio, computeQuestionRate } from "../salesScore";
import { deriveFocus } from "../afterPitch";
import type { TranscriptSegment } from "@/lib/data/salesCoach";
import type { ScoreCategory } from "../summaryTypes";

/**
 * Regression pin for the founder-caught 2026-07-15 bug: the After-Pitch summary
 * contradicted its own data — "Next Door Focus: keep doing what worked" printed
 * on the SAME screen as a computed Talk/Listen score of 100/0.
 *
 * Root cause: the Focus was derived from the LLM narrative ALONE and never read
 * the computed scores. These tests hold the two fixes in place:
 *   F1 — deriveFocus promotes a flagged hard score over a null narrative.
 *   F2 — a one-sided transcript (customer not captured) is a caveat, not a 100/0
 *        verdict, and a caveat can never become the Focus.
 */

function seg(speaker: "agent" | "customer", text: string): TranscriptSegment {
  return { speaker, text } as TranscriptSegment;
}

describe("computeTalkRatio — F2: a one-sided call is a caveat, not a verdict", () => {
  it("returns a capture caveat (not 100/0) when the customer side has no words", () => {
    const c = computeTalkRatio([
      seg("agent", "Hi there, I wanted to tell you about our service today."),
      seg("agent", "It really is a great deal and I think you'll love it."),
      seg("agent", "So what do you think?"),
    ]);
    expect(c).not.toBeNull();
    expect(c!.caveat).toBe(true);
    expect(c!.flagged).toBe(false); // a data gap must never become the Focus
    expect(c!.display).toBe("—"); // never renders a 100/0 number
    expect(c!.rationale).toMatch(/couldn't hear the customer/i);
  });

  it("flags rep-dominant talk (>=75%) as a real growth signal with a focus suggestion", () => {
    // rep ~ many words, customer ~ few → repShare >= 75
    const c = computeTalkRatio([
      seg("agent", "one two three four five six seven eight nine ten eleven twelve"),
      seg("customer", "ok"),
    ]);
    expect(c!.caveat).toBeFalsy();
    expect(c!.flagged).toBe(true);
    expect(c!.focusSuggestion).toBe("Leave more room to listen");
  });

  it("does NOT flag a balanced conversation", () => {
    const c = computeTalkRatio([
      seg("agent", "one two three four five"),
      seg("customer", "one two three four five six"),
    ]);
    expect(c!.flagged).toBe(false);
    expect(c!.focusSuggestion).toBeUndefined();
  });
});

describe("computeQuestionRate — flags too-few questions only", () => {
  it("flags a low question rate (<=15%) with a focus suggestion", () => {
    const turns: TranscriptSegment[] = [];
    for (let i = 0; i < 9; i++) turns.push(seg("agent", "Here is a statement."));
    turns.push(seg("agent", "Is that ok?")); // 1 of 10 = 10%
    const c = computeQuestionRate(turns);
    expect(c!.flagged).toBe(true);
    expect(c!.focusSuggestion).toBe("Ask more discovery questions");
  });

  it("does not flag a question-heavy call (a strength, not a fix)", () => {
    const c = computeQuestionRate([
      seg("agent", "What matters most to you?"),
      seg("agent", "How are you handling it now?"),
    ]);
    expect(c!.flagged).toBe(false);
  });
});

describe("deriveFocus — F1: hard score wins in extremes, caveat never wins", () => {
  const flaggedTalk: ScoreCategory = {
    key: "talk_ratio", label: "Talk / Listen", score: 10, display: "100 / 0",
    rationale: "You did most of the talking — leave more room to listen.",
    citation: null, computed: true, flagged: true, focusSuggestion: "Leave more room to listen",
  };
  const caveatTalk: ScoreCategory = {
    key: "talk_ratio", label: "Talk / Listen", score: 0, display: "—",
    rationale: "We couldn't hear the customer's side on this one.",
    citation: null, computed: true, caveat: true, flagged: false,
  };

  it("THE BUG: a flagged score wins even when the narrative has nothing (no more 'keep doing what worked')", () => {
    const focus = deriveFocus([flaggedTalk], undefined);
    expect(focus).not.toBeNull();
    expect(focus!.focus).toBe("Leave more room to listen");
  });

  it("a flagged hard score wins OVER a narrative growth area (hard score wins in extremes)", () => {
    const focus = deriveFocus([flaggedTalk], { opportunity: "Tighten your close", nextStep: "..." });
    expect(focus!.focus).toBe("Leave more room to listen");
  });

  it("a caveat category is never promoted to the Focus", () => {
    const focus = deriveFocus([caveatTalk], undefined);
    expect(focus).toBeNull(); // caveat is not a fix; nothing else flagged
  });

  it("falls back to the narrative when no score is flagged", () => {
    const focus = deriveFocus([caveatTalk], { opportunity: "Tighten your close", nextStep: "Ask for the appointment" });
    expect(focus!.focus).toBe("Tighten your close");
  });

  it("is null only when nothing is flagged AND the narrative is empty", () => {
    expect(deriveFocus([], undefined)).toBeNull();
  });
});
