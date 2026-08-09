import { describe, it, expect } from "vitest";
import {
  salesFormulateSystemPrompt,
  parseFormulateReply,
} from "@/lib/coach/extension/salesFormulate";

/**
 * Two contracts: (1) the prompt grounds in the sales methodology, anchors the rep, forbids fabrication, and
 * carries the injection fence; (2) parseFormulateReply splits the shared ===REASONING=== marker format (unified
 * with the co-pilot engine 2026-08-09 so the reply streams cleanly — was STRICT JSON) and never errors the rep
 * out when the marker is absent (the whole output is the reply, which the route guards for emptiness). LLM not
 * tested.
 */

describe("salesFormulateSystemPrompt — methodology + anchor + fence", () => {
  it("grounds in the sales methodology block", () => {
    expect(salesFormulateSystemPrompt()).toMatch(/SALES (KNOWLEDGE BASE|METHODOLOGY)/i);
  });

  it("frames it as SHAPING the intent, not judging it", () => {
    expect(salesFormulateSystemPrompt()).toMatch(/shaping their intent, NOT judging/i);
  });

  it("names the rep as the shaping identity", () => {
    expect(salesFormulateSystemPrompt("Dana")).toContain("shaping the message AS: Dana");
  });

  it("forbids inventing a product claim / price / commitment", () => {
    expect(salesFormulateSystemPrompt()).toMatch(/Never invent a product capability, a price/i);
  });

  it("always carries the shared conversation-is-data injection fence", () => {
    expect(salesFormulateSystemPrompt("Dana")).toContain("Untrusted input: the conversation");
    expect(salesFormulateSystemPrompt()).toContain("Untrusted input: the conversation");
  });

  it("instructs the marker format (plain reply first, no JSON) so the reply streams cleanly", () => {
    const p = salesFormulateSystemPrompt();
    expect(p).toContain("===REASONING===");
    expect(p).not.toMatch(/STRICT JSON/i);
  });

  it("carries the charismatic voice rule + the no-dash punctuation rule (founder 2026-08-09)", () => {
    const p = salesFormulateSystemPrompt();
    expect(p).toMatch(/charisma/i);
    expect(p).toMatch(/do NOT use em dashes/i);
  });
});

describe("parseFormulateReply — shared marker split", () => {
  it("splits the reply from the ===REASONING=== move line", () => {
    const out = parseFormulateReply("Happy to walk you through pricing.\n===REASONING===\nanchored on value");
    expect(out.reply).toBe("Happy to walk you through pricing.");
    expect(out.reasoning).toBe("anchored on value");
  });

  it("treats the whole output as the reply when the marker is absent (never errors the rep out)", () => {
    const out = parseFormulateReply("Let me acknowledge the price concern and hold the value.");
    expect(out.reply).toBe("Let me acknowledge the price concern and hold the value.");
    expect(out.reasoning).toBe("");
  });

  it("yields an empty reply when the marker leads (route will 502)", () => {
    const out = parseFormulateReply("===REASONING===\nonly reasoning, no reply");
    expect(out.reply).toBe("");
  });
});
