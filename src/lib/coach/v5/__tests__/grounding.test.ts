import { describe, expect, it } from "vitest";
import { groundQuote } from "../grounding";

/**
 * §3.4 quote grounding — the fabrication guard shared by moments/pivot/score.
 * A quote whose WORDS appear in the transcript survives (punctuation/case differ);
 * a quote whose words are NOT there is dropped (returned null). This is what stops
 * an LLM's invented "customer's words" from reaching a manager as a verbatim quote.
 */
const segs = [
  { text: "So how much does this actually cost per month?" },
  { text: "It's two hundred a seat, billed annually." },
  { text: "Hmm, that's more than I budgeted for." },
];

describe("groundQuote", () => {
  it("keeps a real quote (exact)", () => {
    expect(groundQuote("that's more than I budgeted for", segs)).toBe(
      "that's more than I budgeted for"
    );
  });

  it("keeps a real quote despite different punctuation / casing / smart quotes", () => {
    // The transcript has "It's two hundred a seat"; the model restyled the quote.
    expect(groundQuote("“It’s two hundred a seat…”", segs)).toBe(
      "“It’s two hundred a seat…”"
    );
  });

  it("DROPS a fabricated quote whose words aren't in the transcript", () => {
    expect(
      groundQuote("I love it, where do I sign?", segs)
    ).toBeNull();
  });

  it("drops a paraphrase that changes the words", () => {
    // Same meaning, different words → not a verbatim quote → dropped.
    expect(groundQuote("the price exceeds my budget", segs)).toBeNull();
  });

  it("drops empty / too-short / non-string", () => {
    expect(groundQuote("", segs)).toBeNull();
    expect(groundQuote("  ", segs)).toBeNull();
    expect(groundQuote("cost", segs)).toBeNull(); // < 8 chars of words
    expect(groundQuote(null, segs)).toBeNull();
    expect(groundQuote(undefined, segs)).toBeNull();
  });

  it("returns null when the transcript is empty", () => {
    expect(groundQuote("anything at all here", [])).toBeNull();
  });
});
