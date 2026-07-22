import { describe, it, expect } from "vitest";
import { buildGraderSystemPrompt, buildGraderUserMessage } from "../graderPrompt";
import type { CoachContextType } from "../types";

/**
 * The Coach v5 GRADER prompt — scores sent messages (productive / neutral / needs-guidance), feeding the §3.5
 * metrics and the coach's cross-conversation memory. Distinct from the analysis prompt. F2-class: the grading
 * rules + the message-to-grade must reach the model, and the user-turn's slicing/capping must hold.
 */

const MODES: CoachContextType[] = ["chat_message", "support_reply"];

describe("buildGraderSystemPrompt", () => {
  it("is substantial (identity + knowledge base + grader rules + context note)", () => {
    expect(buildGraderSystemPrompt({ contextType: "chat_message" }).length).toBeGreaterThan(500);
  });

  it("the surface-context note varies by contextType", () => {
    const [a, b] = MODES.map((c) => buildGraderSystemPrompt({ contextType: c }));
    expect(a).not.toBe(b);
    expect(a).toContain("SURFACE CONTEXT NOTE");
  });
});

describe("buildGraderUserMessage", () => {
  it("always leads with the message to grade", () => {
    expect(buildGraderUserMessage({ sentMessage: "here's my reply" })).toMatch(
      /^MESSAGE TO GRADE:\nhere's my reply/
    );
  });

  it("includes the parent message when replying, capped at 800 chars", () => {
    const out = buildGraderUserMessage({ sentMessage: "reply", parentMessage: { author: "Sam", body: "q".repeat(1000) } });
    expect(out).toContain("REPLYING TO Sam");
    // the 1000-char parent body is sliced to 800
    expect(out.match(/q+/)?.[0].length).toBe(800);
  });

  it("caps the recent thread at the last 6 and each body at 400 chars", () => {
    const thread = Array.from({ length: 8 }, (_, i) => ({ author: "u", body: `msg${i}`, timestamp: "t" }));
    const out = buildGraderUserMessage({ sentMessage: "m", recentThread: thread });
    expect(out).toContain("msg7"); // newest kept
    expect(out).not.toContain("msg1"); // 8-6=2 oldest dropped
    expect(out).toContain("msg2"); // boundary: last 6

    const longBody = buildGraderUserMessage({
      sentMessage: "m",
      recentThread: [{ author: "u", body: "z".repeat(500), timestamp: "t" }],
    });
    expect(longBody.match(/z+/)?.[0].length).toBe(400);
  });

  it("is just the message when there's no parent or thread", () => {
    const out = buildGraderUserMessage({ sentMessage: "solo" });
    expect(out).toBe("MESSAGE TO GRADE:\nsolo");
  });
});
