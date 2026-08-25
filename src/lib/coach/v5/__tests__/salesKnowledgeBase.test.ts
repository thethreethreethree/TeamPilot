import { describe, it, expect } from "vitest";
import { getSalesKnowledgeBase } from "../salesKnowledgeBase";

/**
 * Structural-integrity guard for the Sales Knowledge Base (docs/SALES_KNOWLEDGE_BASE.md) — the sibling of the Coach
 * KB (see knowledgeBase.test.ts). Same class: a whole-file-embedded KB the sales prompts reason FROM, previously
 * with no content guard. A26 sweep — both KB instances of the class are now guarded so a truncated load, a dropped
 * book, or a malformed edit fails a test instead of silently degrading the sales coach's grounding.
 *
 * The sales KB format matches the coach KB EXCEPT it has no per-book Source line and no Refuted section, so those
 * assertions are omitted. Count-agnostic: a floor on book count + per-book format, robust to adding books.
 */

const kb = getSalesKnowledgeBase();

function bookSections(md: string): { header: string; body: string }[] {
  const parts = md.split(/^## /m).slice(1);
  return parts
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      return { header: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1) };
    })
    .filter((s) => /^\d+\.\s.*—.*/.test(s.header)); // numbered + em-dash author = a book
}

describe("Sales Knowledge Base — structural integrity (docs/SALES_KNOWLEDGE_BASE.md)", () => {
  it("loads a substantial file (present, not truncated) — the loader's '' fallback would fail this", () => {
    expect(kb.length).toBeGreaterThan(3000);
  });

  it("contains at least the compiled book sections (regression floor — a dropped book fails)", () => {
    expect(bookSections(kb).length).toBeGreaterThanOrEqual(4); // SPIN, Challenger, Never Split, Navigate 2.0
  });

  it("every book section carries the operational principle format the sales coach reasons from", () => {
    const books = bookSections(kb);
    expect(books.length).toBeGreaterThan(0);
    for (const b of books) {
      const label = b.header;
      expect(b.body, `${label}: has a named ### principle`).toMatch(/^### /m);
      expect(b.body, `${label}: When it applies`).toContain("**When it applies:**");
      expect(b.body, `${label}: Canonical move`).toContain("**Canonical move:**");
      expect(b.body, `${label}: Language pattern`).toContain("**Language pattern:**");
      expect(b.body, `${label}: Worked example`).toContain("**Worked example:**");
      expect(b.body, `${label}: has a Before/After worked example`).toMatch(/Before:/);
      expect(b.body, `${label}: has an After line`).toMatch(/After:/);
    }
  });
});
