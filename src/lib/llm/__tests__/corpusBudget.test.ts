import { describe, it, expect } from "vitest";
import { capCorpus, KNOWLEDGE_CORPUS_MAX_CHARS } from "@/lib/llm/corpusBudget";

// Why this exists: capCorpus is the single guard that keeps a large custom knowledge corpus from blowing the
// LLM system prompt past the reasoning model's output clamp and starving the answer to empty (INV22 / §3.4).
// It is wired at the Sales corpus SAVE routes and the LOAD-side prompt chokepoints; these tests pin its
// contract so a regression in the cap is caught before it re-opens the empty-AI class.

describe("capCorpus", () => {
  it("passes content under budget through untouched (not truncated)", () => {
    const input = "a short methodology corpus";
    const r = capCorpus(input);
    expect(r.truncated).toBe(false);
    expect(r.content).toBe(input);
    expect(r.originalChars).toBe(input.length);
  });

  it("treats exactly-at-budget as NOT truncated (boundary is inclusive)", () => {
    const input = "x".repeat(KNOWLEDGE_CORPUS_MAX_CHARS);
    const r = capCorpus(input);
    expect(r.truncated).toBe(false);
    expect(r.content).toBe(input);
  });

  it("truncates over-budget content to <= budget and reports the original size", () => {
    // A clean paragraph break sits late (>= the 85% minKeep floor), so the cut lands on it and drops the tail.
    const head = "a".repeat(23_000);
    const tail = "b".repeat(5_000);
    const input = `${head}\n\n${tail}`; // 28_002 chars
    const r = capCorpus(input);
    expect(r.truncated).toBe(true);
    expect(r.originalChars).toBe(input.length);
    expect(r.content.length).toBeLessThanOrEqual(KNOWLEDGE_CORPUS_MAX_CHARS);
    // The dropped tail must not survive — this is the whole point (no starvation from the ignored remainder).
    expect(r.content.includes("b")).toBe(false);
  });

  it("hard-cuts at the budget when there is no clean boundary near the cap", () => {
    const input = "a".repeat(28_000); // no break anywhere
    const r = capCorpus(input);
    expect(r.truncated).toBe(true);
    expect(r.content.length).toBe(KNOWLEDGE_CORPUS_MAX_CHARS);
  });

  it("is idempotent — capping an already-capped corpus is a no-op", () => {
    const once = capCorpus("a".repeat(28_000)).content;
    const twice = capCorpus(once);
    expect(twice.truncated).toBe(false);
    expect(twice.content).toBe(once);
  });

  it("keeps the budget larger than the built-in KBs but safely under a starving size", () => {
    // Guards the tuning rationale in the file: big enough to be richer than the defaults (~4.6k tok Sales),
    // small enough not to re-starve the 8000-token output clamp (~6k tok at 4 chars/token).
    expect(KNOWLEDGE_CORPUS_MAX_CHARS).toBeGreaterThan(18_000); // > ~4.6k tokens
    expect(KNOWLEDGE_CORPUS_MAX_CHARS).toBeLessThanOrEqual(28_000); // < ~7k tokens
  });
});
