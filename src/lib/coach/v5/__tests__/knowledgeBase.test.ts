import { describe, it, expect } from "vitest";
import { getKnowledgeBase } from "../knowledgeBase";

/**
 * Structural-integrity guard for the Coach v5 Knowledge Base (docs/COACH_KNOWLEDGE_BASE.md), the primary-source
 * principle library the Coach embeds WHOLE in every call. buildSystemPrompt.test.ts only checks that *some* KB text
 * reaches the prompt (length > 500); nothing guarded the KB CONTENT. This locks it structurally so a truncated load,
 * a dropped book, or a malformed edit fails a test instead of silently degrading the Coach's grounding.
 *
 * COUNT-AGNOSTIC on purpose: it asserts a floor (never drop below the verified books) and per-book FORMAT, so it
 * passes at 7 books today and automatically covers new books (Carnegie / Gladwell / Stone-Patton-Heen) as they land
 * — the completion of the 10-book KB (D6) raises the floor without changing the format contract.
 */

const kb = getKnowledgeBase();

// A book section header looks like `## 1. On Writing Well — William Zinsser` (numbered + an em-dash author).
// The non-book sections (Convergences / How to Use / Refuted) are `## N. Title` with NO em-dash, so this isolates books.
function bookSections(md: string): { header: string; body: string }[] {
  const parts = md.split(/^## /m).slice(1); // drop the file title preamble
  return parts
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      return { header: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1) };
    })
    .filter((s) => /^\d+\.\s.*—.*/.test(s.header)); // numbered + em-dash author = a book
}

describe("Coach Knowledge Base — structural integrity (docs/COACH_KNOWLEDGE_BASE.md)", () => {
  it("loads a substantial file (not empty / not truncated)", () => {
    expect(kb.length).toBeGreaterThan(5000); // the real KB is ~9k tokens; a truncated load fails here
  });

  it("contains all 10 verified books (regression floor — a dropped book fails)", () => {
    expect(bookSections(kb).length).toBeGreaterThanOrEqual(10); // 10/10 as of 2026-08-25 (D6 complete)
  });

  it("every book section carries the operational principle format the Coach reasons from", () => {
    const books = bookSections(kb);
    expect(books.length).toBeGreaterThan(0);
    for (const b of books) {
      const label = b.header;
      expect(b.body, `${label}: has a Source(s) line`).toMatch(/\*\*Sources?:\*\*/); // "Source:" or "Sources:"
      expect(b.body, `${label}: has a named ### principle`).toMatch(/^### /m);
      expect(b.body, `${label}: When it applies`).toContain("**When it applies:**");
      expect(b.body, `${label}: Canonical move`).toContain("**Canonical move:**");
      expect(b.body, `${label}: Language pattern`).toContain("**Language pattern:**");
      expect(b.body, `${label}: Worked example`).toContain("**Worked example:**");
      expect(b.body, `${label}: has a Before/After worked example`).toMatch(/Before:/);
      expect(b.body, `${label}: has an After line`).toMatch(/After:/);
    }
  });

  it("keeps the Refuted-claims section (the Coach must know what NOT to cite)", () => {
    expect(kb).toMatch(/##\s+\d+\.\s+Refuted Claims/i);
  });
});
