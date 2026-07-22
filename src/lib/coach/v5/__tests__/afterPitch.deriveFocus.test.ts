import { describe, it, expect } from "vitest";
import { deriveFocus } from "../afterPitch";
import type { ScoreCategory } from "../summaryTypes";

/**
 * deriveFocus reconciles the ONE "Next Door Focus" across the score engine and the narrative engine. It is the
 * guard for a founder-caught §3.4/§3.5 bug (2026-07-15): the Focus used to be the narrative's top growth area
 * ALONE, so on a thin transcript it went null and the card printed "keep doing what worked" — while the computed
 * talk-ratio sat at 100/0 with "leave more room to listen". The rule: a flagged computed score WINS (it's
 * deterministic + undeniable); the narrative is the default only when nothing is flagged. The invariant these
 * tests pin: the Focus is NEVER null while any score is flagged — a red number and "keep doing what worked" can
 * never share a screen again. Pure function, was untested (found via a function-level coverage survey).
 */

const score = (over: Partial<ScoreCategory>): ScoreCategory =>
  ({ key: "talk_ratio", score: 5, rationale: "default", ...over }) as ScoreCategory;

describe("deriveFocus — hard score wins in extremes", () => {
  it("a flagged score with a focusSuggestion becomes the Focus, ahead of the narrative", () => {
    const scores = [
      score({ flagged: true, focusSuggestion: "Leave more room to listen", rationale: "Talk ratio 100/0" }),
    ];
    expect(deriveFocus(scores, { opportunity: "Build rapport", nextStep: "Ask about their week" })).toEqual({
      focus: "Leave more room to listen",
      why: "Talk ratio 100/0",
    });
  });

  it("THE INVARIANT: a flagged score → Focus is NEVER null, even when the narrative has no growth area", () => {
    const scores = [score({ flagged: true, focusSuggestion: "Leave more room to listen", rationale: "100/0" })];
    const focus = deriveFocus(scores, undefined);
    expect(focus).not.toBeNull();
    expect(focus!.focus).toBe("Leave more room to listen");
  });

  it("the FIRST flagged score wins (scores are in rubric order → more fundamental behaviour)", () => {
    const scores = [
      score({ key: "talk_ratio", flagged: true, focusSuggestion: "Listen more", rationale: "r1" }),
      score({ key: "question_rate", flagged: true, focusSuggestion: "Ask more", rationale: "r2" }),
    ];
    expect(deriveFocus(scores, undefined)!.focus).toBe("Listen more");
  });

  it("a flagged score WITHOUT a focusSuggestion is skipped → falls through to the narrative", () => {
    const scores = [score({ flagged: true, focusSuggestion: undefined })];
    expect(deriveFocus(scores, { opportunity: "Slow down", nextStep: "Pause after questions" })).toEqual({
      focus: "Slow down",
      why: "Pause after questions",
    });
  });

  it("no flagged score + a top growth area → the narrative carries the Focus", () => {
    expect(deriveFocus([score({})], { opportunity: "Ask discovery Qs", nextStep: "Open-ended" })).toEqual({
      focus: "Ask discovery Qs",
      why: "Open-ended",
    });
  });

  it("no flagged score + no growth area → Focus is legitimately null (nothing stood out)", () => {
    expect(deriveFocus([score({})], undefined)).toBeNull();
  });
});
