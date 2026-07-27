import { describe, it, expect } from "vitest";
import { extractFileMentions, buildFileMention, detectFileMentionContext } from "../fileMention";

/**
 * File-mention parsing (`@file[Title](uuid)`) + the autocomplete trigger detector.
 */

const U1 = "7da30c76-1234-4abc-89ab-0123456789ab";
const U2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("extractFileMentions", () => {
  it("returns [] for null / mention-free text", () => {
    expect(extractFileMentions(null)).toEqual([]);
    expect(extractFileMentions("no files here")).toEqual([]);
  });

  it("extracts a single file mention", () => {
    expect(extractFileMentions(`see @file[Q3 Report.pdf](${U1})`)).toEqual([
      { title: "Q3 Report.pdf", fileId: U1 },
    ]);
  });

  it("dedupes the same file cited twice", () => {
    const r = extractFileMentions(`@file[a](${U1}) and @file[a again](${U1})`);
    expect(r).toHaveLength(1);
    expect(r[0]?.fileId).toBe(U1);
  });

  it("extracts two distinct files in order", () => {
    const r = extractFileMentions(`@file[a](${U1}) @file[b](${U2})`);
    expect(r.map((m) => m.fileId)).toEqual([U1, U2]);
  });

  it("ignores a malformed (non-UUID) id — a typo renders as text, not a chip", () => {
    expect(extractFileMentions("@file[a](not-a-uuid)")).toEqual([]);
  });
});

describe("buildFileMention", () => {
  it("builds the canonical marker", () => {
    expect(buildFileMention({ title: "Report", fileId: U1 })).toBe(`@file[Report](${U1})`);
  });

  it("strips brackets from the title so it can never break the pattern", () => {
    // A title containing ] would otherwise close the [...] group early and corrupt the marker.
    expect(buildFileMention({ title: "a[b]c", fileId: U1 })).toBe(`@file[abc](${U1})`);
  });
});

/**
 * detectFileMentionContext — the autocomplete trigger. Fixed 2026-07-22: the query used to always come back
 * empty (the walk-back stopped at the space in "@file <query>"), so search-as-you-type never worked. These
 * tests would FAIL on the old code and pin the fix while preserving the 2026-06-19 Finding #2 guard.
 */
describe("detectFileMentionContext", () => {
  it("triggers on a bare @file with an empty query (picker opens, unfiltered)", () => {
    expect(detectFileMentionContext("@file", 5)).toEqual({ triggerStart: 0, query: "" });
    expect(detectFileMentionContext("@file ", 6)).toEqual({ triggerStart: 0, query: "" });
  });

  it("captures the typed query — the core fix (was always empty before)", () => {
    expect(detectFileMentionContext("@file report", 12)).toEqual({ triggerStart: 0, query: "report" });
    expect(detectFileMentionContext("hi @file budget", 15)).toEqual({ triggerStart: 3, query: "budget" });
  });

  it("does NOT trigger on a plain word like @filename.pdf (Finding #2 preserved)", () => {
    expect(detectFileMentionContext("@filename.pdf", 13)).toBeNull();
    expect(detectFileMentionContext("@filefoo", 8)).toBeNull();
  });

  it("requires a word boundary before @file", () => {
    expect(detectFileMentionContext("x@file", 6)).toBeNull();
    expect(detectFileMentionContext("email@file", 10)).toBeNull();
  });

  it("ends the mention at a second space or a completed marker", () => {
    expect(detectFileMentionContext("@file foo bar", 13)).toBeNull(); // second word ends it
    expect(
      detectFileMentionContext("@file[T](7da30c76-1234-4abc-89ab-0123456789ab)", 46)
    ).toBeNull(); // already a completed mention
  });
});
