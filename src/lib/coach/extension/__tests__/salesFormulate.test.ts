import { describe, it, expect } from "vitest";
import {
  salesFormulateSystemPrompt,
  parseFormulateReply,
} from "@/lib/coach/extension/salesFormulate";

/**
 * Two contracts: (1) the prompt grounds in the sales methodology, anchors the rep, forbids fabrication, and
 * carries the injection fence; (2) parseFormulateReply survives a ```json fence and never errors the rep out
 * on non-JSON (falls back to raw text as the reply, which the route guards for emptiness). LLM not tested.
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
});

describe("parseFormulateReply", () => {
  it("parses clean JSON {reply, reasoning}", () => {
    const out = parseFormulateReply('{"reply":"Happy to walk you through pricing.","reasoning":"anchored on value"}');
    expect(out.reply).toBe("Happy to walk you through pricing.");
    expect(out.reasoning).toBe("anchored on value");
  });

  it("survives a ```json fence / preamble", () => {
    const out = parseFormulateReply('Here you go:\n```json\n{"reply":"Let me address the cost.","reasoning":"labeled the concern"}\n```');
    expect(out.reply).toBe("Let me address the cost.");
    expect(out.reasoning).toBe("labeled the concern");
  });

  it("falls back to the raw text as the reply on non-JSON (never errors the rep out)", () => {
    const out = parseFormulateReply("Let me acknowledge the price concern and hold the value.");
    expect(out.reply).toBe("Let me acknowledge the price concern and hold the value.");
    expect(out.reasoning).toBe("");
  });

  it("yields an empty reply when the JSON has no reply string (route will 502)", () => {
    const out = parseFormulateReply('{"reasoning":"only reasoning, no reply"}');
    expect(out.reply).toBe("");
  });
});
