import { describe, expect, it } from "vitest";
import { detectHandoffSignal } from "../prompt";

/**
 * detectHandoffSignal tests.
 *
 * This function gates §3.3 behavior: when the AI says it will hand off,
 * the Care route flips ai_responding=false so the AI actually cedes the
 * thread instead of talking over the human who now owns it. A false
 * NEGATIVE (missed handoff) is the dangerous case — the AI keeps
 * auto-replying after promising a human. These tests pin the phrase
 * coverage down, and one explicitly documents the known recall ceiling
 * (§3.4 — the limitation is on the record, not hidden).
 */
describe("detectHandoffSignal", () => {
  it("detects the canonical handoff phrases", () => {
    const phrases = [
      "I'll bring in a teammate who can help with that.",
      "Let me bring in a colleague for this one.",
      "I'm going to bring in a specialist.",
      "Let me pull in a teammate to take this.",
      "I'm pulling in a teammate to take this.", // the codebase's own fallback wording
      "Let me pull in a colleague.",
      "I'll get you to someone who can dig in.",
      "Let me get you to a teammate.",
      "I'll get you to a colleague on the billing side.",
      "I'll connect you with our billing team.",
      "Let me connect you to a specialist.",
      "I'm going to hand you off to a teammate.",
      "Let me hand you over to someone.",
      "I'll hand this off to the team.",
      "Let me hand this over to a colleague.",
      "Let me loop in a human here.",
      "I'll loop in a teammate.",
      "Let me loop in a colleague.",
      "I'll escalate this to our team.",
      "Let me escalate you to a specialist.",
      "Someone from our team will follow up shortly.",
      "Someone from the team will reach out.",
    ];
    for (const p of phrases) {
      expect(detectHandoffSignal(p), `should detect: ${p}`).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(detectHandoffSignal("I'LL BRING IN A TEAMMATE.")).toBe(true);
    expect(detectHandoffSignal("Pulling In A Teammate now.")).toBe(true);
  });

  it("does not fire on ordinary replies", () => {
    const notHandoffs = [
      "Here's how to reset your password: go to Settings > Security.",
      "Thanks for reaching out! Your refund has been processed.",
      "Our team will keep improving the product based on feedback.", // 'our team will' alone is NOT a handoff
      "I can help you with that right now.",
      "Great question — the plan includes 5 seats.",
      "",
    ];
    for (const p of notHandoffs) {
      expect(detectHandoffSignal(p), `should NOT detect: ${p}`).toBe(false);
    }
  });

  it("documents the known recall ceiling (false negatives the heuristic misses)", () => {
    // These ARE handoffs in intent but use vocabulary outside the phrase
    // list. Documented on the record (§3.4) rather than silently assumed
    // covered — the robust fix is the prompt sentinel noted in the source.
    const missed = [
      "Let me refer you to my manager.",
      "I'll ask a specialist to reach out to you.",
      "Let me get a human on this.",
    ];
    for (const p of missed) {
      expect(detectHandoffSignal(p)).toBe(false);
    }
  });
});
