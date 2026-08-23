import { describe, it, expect, vi } from "vitest";

// The prep builders' modules import the LLM client at module top; the builders themselves are pure and never
// call it, so a no-op mock keeps the import graph light without affecting what we assert.
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));

import { methodologyBlock } from "@/lib/coach/v5/salesReviewPrompt";
import { reviewProductBlock } from "@/lib/coach/v5/prepShared";
import { buildPrepSystemPrompt } from "@/lib/coach/v5/salesPrep";
import { buildQASystemPrompt } from "@/lib/coach/v5/salesPrepQA";
import { KNOWLEDGE_CORPUS_MAX_CHARS } from "@/lib/llm/corpusBudget";

// Why this exists (A30 gate for the INV22 / §3.4 re-starvation class): every place that injects an
// admin-editable corpus into an LLM system prompt must route it through capCorpus, or a large corpus blows the
// prompt past the reasoning model's output clamp and starves the answer to empty. These tests fail the moment
// any of the four injection chokepoints stops capping — they are the structural defense the prose lesson needs.

// An over-budget corpus whose tail sits after a clean paragraph break well past the 85% floor: capCorpus keeps
// the head and DROPS the marked tail. If the cap is removed, the marker survives — that is the detection.
const TAIL = "CORPUS_TAIL_MUST_BE_DROPPED";
const oversized = "a".repeat(23_000) + "\n\n" + TAIL.repeat(400); // ~34k chars

// A normal, under-budget corpus with a distinctive marker must pass through UNTOUCHED (the cap only fires when
// genuinely over budget — it never mangles a real corpus).
const NORMAL = "SMALL_CORPUS_MARKER kept verbatim";

describe("corpus-cap wiring — every LLM injection chokepoint caps to the shared budget", () => {
  it("methodologyBlock caps an oversized custom corpus (drops the tail, keeps the wrapper)", () => {
    const out = methodologyBlock(oversized);
    expect(out.includes(TAIL)).toBe(false);
    expect(out.includes("SALES KNOWLEDGE BASE")).toBe(true);
  });

  it("methodologyBlock leaves a normal corpus verbatim", () => {
    expect(methodologyBlock(NORMAL).includes("SMALL_CORPUS_MARKER kept verbatim")).toBe(true);
  });

  it("reviewProductBlock caps an oversized product corpus", () => {
    const out = reviewProductBlock(oversized);
    expect(out.includes(TAIL)).toBe(false);
    expect(out.includes("PRODUCT / OFFER DETAILS")).toBe(true);
  });

  it("buildPrepSystemPrompt caps BOTH the methodology and the product corpus", () => {
    const out = buildPrepSystemPrompt(oversized, oversized);
    expect(out.includes(TAIL)).toBe(false);
  });

  it("buildQASystemPrompt caps BOTH the methodology and the product corpus", () => {
    const out = buildQASystemPrompt(oversized, oversized);
    expect(out.includes(TAIL)).toBe(false);
  });

  it("the emitted corpus in each block stays within the budget (+ small wrapper), never the raw 34k", () => {
    // A coarse ceiling: the injected corpus can't exceed the budget; the surrounding wrapper text is small.
    for (const out of [methodologyBlock(oversized), reviewProductBlock(oversized)]) {
      expect(out.length).toBeLessThan(KNOWLEDGE_CORPUS_MAX_CHARS + 2_000);
    }
  });
});
