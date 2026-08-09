import { describe, it, expect } from "vitest";
import {
  REASONING_MARKER,
  reasoningInstruction,
  splitReplyReasoning,
  salesVoiceRule,
  stripAiDashes,
  finalizeSuggestion,
} from "@/lib/coach/extension/salesSuggestFormat";

/**
 * The shared reply/move format both Suggested Response engines emit, so a single streaming reader splits them
 * identically. The reply is everything BEFORE the marker (what streams to the rep); the move is after it.
 */

describe("salesSuggestFormat — shared marker split", () => {
  it("splits reply (before marker) from the move (after)", () => {
    const { reply, reasoning } = splitReplyReasoning(
      `Thanks — what does the delay cost you weekly?\n${REASONING_MARKER}\nasked a SPIN implication question`
    );
    expect(reply).toBe("Thanks — what does the delay cost you weekly?");
    expect(reasoning).toBe("asked a SPIN implication question");
  });

  it("treats the whole output as the reply when the marker never arrives", () => {
    const { reply, reasoning } = splitReplyReasoning("Just the draft, no move named.");
    expect(reply).toBe("Just the draft, no move named.");
    expect(reasoning).toBe("");
  });

  it("yields an empty reply when the marker leads (so the route/stream can 502 honestly)", () => {
    const { reply } = splitReplyReasoning(`${REASONING_MARKER}\nnamed the move but drafted nothing`);
    expect(reply).toBe("");
  });

  it("reasoningInstruction names the marker and orders reply-first (so the reply streams before the move)", () => {
    const instr = reasoningInstruction();
    expect(instr).toContain(REASONING_MARKER);
    expect(instr).toMatch(/reply FIRST/i);
  });
});

describe("salesVoiceRule — charisma + natural voice + no AI-tell dashes (founder 2026-08-09)", () => {
  const rule = salesVoiceRule();

  it("centers charisma as the personality (the founder's core note)", () => {
    expect(rule).toMatch(/charisma/i);
    expect(rule).toMatch(/magnetic|warm|playful|personable/i);
  });

  it("forbids em/en dashes and triple dashes (the live-draft AI-tell the founder flagged)", () => {
    expect(rule).toMatch(/do NOT use em dashes/i);
    expect(rule).toContain("—");
    expect(rule).toContain("---");
  });

  it("keeps it professional, not fake hype (charisma = warmth + confidence)", () => {
    expect(rule).toMatch(/professional/i);
    expect(rule).toMatch(/never (fake|force)/i);
  });
});

describe("stripAiDashes — deterministic no-em-dash guarantee (founder 'make sure no --- character')", () => {
  it("replaces a spaced em dash with a natural comma", () => {
    expect(stripAiDashes("To answer your question — I'm looking for users.")).toBe(
      "To answer your question, I'm looking for users."
    );
  });

  it("replaces en dash and triple dash too", () => {
    expect(stripAiDashes("Pricing – let's talk.")).toBe("Pricing, let's talk.");
    expect(stripAiDashes("Wait --- one more thing.")).toBe("Wait, one more thing.");
  });

  it("LEAVES a normal hyphen alone (day-to-day, phone numbers are legitimate)", () => {
    expect(stripAiDashes("Our day-to-day is 555-1234.")).toBe("Our day-to-day is 555-1234.");
  });

  it("does not leave an awkward comma before end punctuation", () => {
    expect(stripAiDashes("Sounds good —.")).toBe("Sounds good.");
    expect(stripAiDashes("Great. — Talk soon.")).toBe("Great. Talk soon.");
  });

  it("finalizeSuggestion splits AND sanitizes both the reply and the move", () => {
    const out = finalizeSuggestion("All good — hope you're well.\n===REASONING===\nwarm open — built rapport");
    expect(out.reply).toBe("All good, hope you're well.");
    expect(out.reasoning).toBe("warm open, built rapport");
    expect(out.reply).not.toMatch(/[—–]/);
  });
});
