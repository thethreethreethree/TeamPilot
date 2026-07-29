import { describe, it, expect } from "vitest";
import { extractObjectionGuidance } from "../objectionGuidance";

describe("extractObjectionGuidance", () => {
  it("returns '' when there is no methodology or no objection content", () => {
    expect(extractObjectionGuidance(null)).toBe("");
    expect(extractObjectionGuidance("")).toBe("");
    expect(extractObjectionGuidance("Open with rapport. Ask discovery questions. Close clearly.")).toBe("");
  });

  it("pulls the objection-relevant blocks out of the methodology", () => {
    const md = `# Our method

Open with genuine rapport and ask about their situation.

## Handling objections
When they say "too expensive", reframe to value-per-day, never argue the price.

## Closing
Make the next step small and specific.`;
    const out = extractObjectionGuidance(md);
    expect(out).toContain("too expensive");
    expect(out).toContain("reframe to value-per-day");
    // Non-objection blocks are excluded.
    expect(out).not.toContain("genuine rapport");
    expect(out).not.toContain("next step small");
  });

  it("SURVIVES TRUNCATION: objection rules placed past the first 600 chars are still extracted", () => {
    // This is the whole point (founder 2026-07-30): the live-cue path truncates methodology to 600
    // chars, so objection rules further down would be lost without this extraction.
    const filler = "Discovery is everything; ask open questions and listen. ".repeat(20); // > 600 chars
    const md = `${filler}\n\nObjection rule: when the prospect is not interested, acknowledge first, then ask one question.`;
    expect(md.indexOf("Objection rule")).toBeGreaterThan(600);
    const out = extractObjectionGuidance(md);
    expect(out).toContain("not interested");
    expect(out).toContain("acknowledge first");
    expect(out).not.toContain("Discovery is everything");
  });

  it("bounds the output to maxChars", () => {
    const md = Array.from({ length: 50 }, (_, i) => `- Objection ${i}: they push back, so rebuttal number ${i} applies here.`).join("\n");
    const out = extractObjectionGuidance(md, 300);
    expect(out.length).toBeLessThanOrEqual(301); // maxChars + the "…" ellipsis
  });
});
