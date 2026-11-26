import { describe, it, expect } from "vitest";
import { keytermsQuery, MAX_TERMS, normaliseKeyterms, VocabularyError } from "../vocabulary";

/**
 * Transcription vocabulary (Gong F8.9, 0306). A list the provider would refuse fails EVERY transcription for the
 * company, so the provider's documented rules are enforced on save; the realtime encoding is the one verified live.
 */
describe("normaliseKeyterms", () => {
  it("trims, collapses spaces, drops blanks and case-insensitive duplicates", () => {
    expect(normaliseKeyterms(["  AT&T   Fiber ", "", "Spectrum", "spectrum"])).toEqual(["AT&T Fiber", "Spectrum"]);
  });
  it("refuses what the provider refuses: >50 chars, >5 words, < > { } [ ] \\", () => {
    expect(() => normaliseKeyterms(["x".repeat(51)])).toThrow(VocabularyError);
    expect(() => normaliseKeyterms(["one two three four five six"])).toThrow(VocabularyError);
    for (const bad of ["<b>", "{x}", "[x]", "a\\b"]) expect(() => normaliseKeyterms([bad])).toThrow(VocabularyError);
  });
  it(`caps the list at ${MAX_TERMS} (above 100 the provider bills a 20-second minimum per request)`, () => {
    expect(normaliseKeyterms(Array.from({ length: MAX_TERMS }, (_, i) => `term ${i}`))).toHaveLength(MAX_TERMS);
    expect(() => normaliseKeyterms(Array.from({ length: MAX_TERMS + 1 }, (_, i) => `term ${i}`))).toThrow(VocabularyError);
  });
  it("an empty list is valid — it turns vocabulary off", () => {
    expect(normaliseKeyterms([])).toEqual([]);
  });
});

describe("keytermsQuery", () => {
  it("repeats keyterms= per term, URL-encoded (the realtime encoding verified live 2026-11-22)", () => {
    expect(keytermsQuery(["Spectrum", "AT&T Fiber"])).toBe("&keyterms=Spectrum&keyterms=AT%26T%20Fiber");
    expect(keytermsQuery([])).toBe("");
  });
});

describe("readCompanyKeyterms never stops a transcription", () => {
  it("returns [] when the read errors or the client throws", async () => {
    const { readCompanyKeyterms } = await import("../vocabulary");
    const erroring = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: { code: "XX", message: "boom" } }) }) }) }) }) }) };
    const throwing = { from: () => { throw new Error("no table"); } };
    expect(await readCompanyKeyterms(erroring as never, "c1")).toEqual([]);
    expect(await readCompanyKeyterms(throwing as never, "c1")).toEqual([]);
  });
});

import { applyCorrections, parseVocabularyLines } from "../vocabulary";

describe("known mis-hearings (0354, F8.9)", () => {
  it("parses 'Term = heard, heard'; a plain line is a term", () => {
    expect(parseVocabularyLines(["Spectrum = spec trum,  spektrum ", "AT&T Fiber", "", "Specs = "])).toEqual({
      terms: ["Spectrum", "AT&T Fiber", "Specs"],
      corrections: [{ term: "Spectrum", heard: ["spec trum", "spektrum"] }],
    });
  });
  it("refuses a mis-hearing listed for two terms, and a line with nothing before '='", () => {
    expect(() => parseVocabularyLines(["Spectrum = spec", "Specter = spec"])).toThrow(VocabularyError);
    expect(() => parseVocabularyLines([" = spec"])).toThrow(VocabularyError);
  });
  it("replaces whole words and phrases, any capitalisation, longest first — never inside a word", () => {
    const c = [{ term: "Spectrum", heard: ["spec trum", "spektrum"] }, { term: "Spectrum Plus", heard: ["spec trum plus"] }];
    expect(applyCorrections("We have Spec  Trum right now", c)).toBe("We have Spectrum right now");
    expect(applyCorrections("is spec trum plus cheaper", c)).toBe("is Spectrum Plus cheaper");
    expect(applyCorrections("SPEKTRUM, then", c)).toBe("Spectrum, then");
    expect(applyCorrections("a spectrummy line, aspektrum", c)).toBe("a spectrummy line, aspektrum");
    expect(applyCorrections("nothing here", [])).toBe("nothing here");
  });
});

