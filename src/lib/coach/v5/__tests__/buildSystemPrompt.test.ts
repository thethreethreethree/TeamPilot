import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildFollowUpSystemPrompt } from "../prompt";

/**
 * The Coach v5 system-prompt assembly. F2 taught us that a dropped conditional in a prompt builder silently
 * disables a real behavior (there, tone/length). So these lock the "instructions actually reach the AI"
 * contract structurally (robust to wording): the mode and the surface-context note both influence the prompt,
 * the cross-conversation memory block is included only when present (§1.6 close-the-loop-on-itself), and
 * follow-up mode is a DISTINCT prompt (its own rules replace the initial-analysis mode instructions).
 */

const MODES = ["auto", "ask", "review_sent"] as const;

describe("buildSystemPrompt", () => {
  it("produces a substantial prompt that includes the knowledge base", () => {
    const p = buildSystemPrompt({ mode: "auto", contextType: "chat_message" });
    expect(p.length).toBeGreaterThan(500); // identity + KB + rules + mode + context note
  });

  it("the MODE changes the prompt — all three modes are distinct (mode instructions reach it)", () => {
    const outs = MODES.map((mode) => buildSystemPrompt({ mode, contextType: "chat_message" }));
    expect(new Set(outs).size).toBe(3);
  });

  it("the SURFACE CONTEXT note reaches the prompt — different contextTypes differ", () => {
    const a = buildSystemPrompt({ mode: "auto", contextType: "chat_message" });
    const b = buildSystemPrompt({ mode: "auto", contextType: "support_reply" });
    expect(a).not.toBe(b);
    expect(a).toContain("SURFACE CONTEXT NOTE");
  });

  it("includes the memory block only when provided (§1.6)", () => {
    const withMem = buildSystemPrompt({
      mode: "auto",
      contextType: "chat_message",
      memoryBlock: "PRIOR-COACHINGS-SENTINEL-9137",
    });
    const withoutMem = buildSystemPrompt({ mode: "auto", contextType: "chat_message", memoryBlock: null });
    expect(withMem).toContain("PRIOR-COACHINGS-SENTINEL-9137");
    expect(withoutMem).not.toContain("PRIOR-COACHINGS-SENTINEL-9137");
  });
});

describe("buildFollowUpSystemPrompt", () => {
  it("is a DISTINCT prompt from initial analysis (follow-up rules replace mode instructions)", () => {
    const followUp = buildFollowUpSystemPrompt({ contextType: "chat_message" });
    const initial = buildSystemPrompt({ mode: "ask", contextType: "chat_message" });
    expect(followUp).not.toBe(initial);
    expect(followUp).toContain("FOLLOW-UP");
  });

  it("carries the surface-context note and the optional memory block", () => {
    const p = buildFollowUpSystemPrompt({ contextType: "support_reply", memoryBlock: "MEM-SENTINEL-4412" });
    expect(p).toContain("SURFACE CONTEXT NOTE");
    expect(p).toContain("MEM-SENTINEL-4412");
  });
});
