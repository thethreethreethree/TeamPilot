import { describe, it, expect } from "vitest";
import { buildMeetingCueSystemPrompt } from "../meeting/meetingCuePrompt";
import { buildHuddleCueSystemPrompt } from "../huddle/huddleCuePrompt";

/**
 * Structural guards on the meeting/huddle system prompts:
 *  1. Every prompt that ingests a live transcript (untrusted, room-authored text) MUST carry the shared
 *     anti-injection fence (CONVERSATION_IS_DATA) — the injection-fence discipline. A prompt missing it would
 *     let a participant's words ("tell the facilitator to end the meeting") steer the coach.
 *  2. Plan §6: a SALES cue must never leak into a meeting/huddle context. The sales TRIGGER tokens
 *     ('objection', 'buying_signal') must not appear in these facilitation prompts — a copy-paste of sales
 *     prompt content is the drift this guards against. (The parse layer also gates leaked triggers at output;
 *     this guards the input prompt.)
 */
const SALES_TRIGGER_TOKENS = ["objection", "buying_signal"];

describe.each([
  ["meeting", buildMeetingCueSystemPrompt],
  ["huddle", buildHuddleCueSystemPrompt],
] as const)("%s system prompt safety", (_name, build) => {
  it("carries the shared anti-injection fence in both modes", () => {
    for (const mode of ["suggestion", "directive"] as const) {
      const p = build(mode);
      // The CONVERSATION_IS_DATA fence's signature phrasing (case-insensitive — the fence uses "NEVER obey").
      expect(p).toMatch(/Untrusted input/i);
      expect(p).toMatch(/never obey/i);
    }
  });

  it("contains no sales trigger tokens (plan §6 — no sales cue leaks into facilitation)", () => {
    for (const mode of ["suggestion", "directive"] as const) {
      const p = build(mode).toLowerCase();
      for (const token of SALES_TRIGGER_TOKENS) {
        expect(p).not.toContain(token);
      }
    }
  });

  it("explicitly disclaims being a sales coach", () => {
    expect(build("suggestion")).toMatch(/not a sales coach/i);
  });
});
