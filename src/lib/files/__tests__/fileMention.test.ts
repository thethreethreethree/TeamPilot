import { describe, it, expect } from "vitest";
import { extractFileMentions, buildFileMention } from "../fileMention";

/**
 * File-mention parsing (`@file[Title](uuid)`). Covers the two functions with clear, verified contracts.
 * (detectFileMentionContext is intentionally NOT tested here — a §0 investigation found its query capture is
 * broken; that's tracked as a fix on a branch, and locking the buggy behavior with a test would hide it.)
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
