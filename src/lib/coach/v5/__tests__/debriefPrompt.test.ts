import { describe, it, expect } from "vitest";
import { buildDebriefSystemPrompt, buildDebriefUserMessage } from "../debriefPrompt";
import type { CoachDebriefMessage } from "../types";

/**
 * The end-of-conversation debrief (§1.6 close-the-loop, §3.5 measure-consequence). buildDebriefUserMessage
 * assembles the user's sent messages WITH their recorded grades, plus the cross-conversation memory block
 * (renderMemoryForPrompt's output). Distinct assembly, untested. Key properties: grades are labelled EXCEPT
 * "withheld" (don't surface a withheld grade), bodies are capped, and the memory block appends only when present.
 */

const msg = (body: string, grade?: string): CoachDebriefMessage => ({ body, grade } as unknown as CoachDebriefMessage);

describe("buildDebriefSystemPrompt", () => {
  it("is a substantial peer-register debrief prompt", () => {
    expect(buildDebriefSystemPrompt({ surface: "chat_topic" }).length).toBeGreaterThan(200);
  });
});

describe("buildDebriefUserMessage", () => {
  it("numbers the sent messages and labels their grades", () => {
    const out = buildDebriefUserMessage({
      messages: [msg("nice open", "productive"), msg("hm", "needs_guidance")],
      memoryBlock: null,
    });
    expect(out).toContain("1. [graded: productive] nice open");
    expect(out).toContain("2. [graded: needs_guidance] hm");
  });

  it("does NOT surface a 'withheld' grade (no label)", () => {
    const out = buildDebriefUserMessage({ messages: [msg("draft", "withheld")], memoryBlock: null });
    expect(out).toContain("draft");
    expect(out).not.toContain("withheld");
    expect(out).not.toContain("[graded:");
  });

  it("caps each message body at 1000 chars", () => {
    const out = buildDebriefUserMessage({ messages: [msg("q".repeat(1500), "neutral")], memoryBlock: null });
    expect(out.match(/q+/)?.[0].length).toBe(1000);
  });

  it("appends the memory block only when present (§1.6 close-the-loop)", () => {
    const withMem = buildDebriefUserMessage({ messages: [msg("x", "neutral")], memoryBlock: "MEM-SENTINEL-771" });
    expect(withMem).toContain("MEM-SENTINEL-771");
    const withoutMem = buildDebriefUserMessage({ messages: [msg("x", "neutral")], memoryBlock: null });
    expect(withoutMem).not.toContain("MEM-SENTINEL-771");
  });

  it("includes the conversation title when given", () => {
    const out = buildDebriefUserMessage({
      conversationTitle: "Refund escalation",
      messages: [msg("x", "neutral")],
      memoryBlock: null,
    });
    expect(out).toContain("CONVERSATION: Refund escalation");
  });
});
