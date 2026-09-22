import { describe, it, expect } from "vitest";
// @ts-expect-error — plain ESM helper, no types
import { frontMatter } from "../lib.mjs";

/**
 * The gate's front-matter parser, and the line ending that made it blind.
 *
 * `frontMatter` returning null is not an error anyone sees. `currentBuildDir()` treats a build
 * with no readable `started_at` as un-dated and falls back to its directory NAME, and a name never
 * wins against a real timestamp — so the gate goes on validating an older build and reports green
 * for a document it never opened.
 *
 * That is what `^---\n` did on Windows. A think.md written with CRLF opens `---\r\n`, which the
 * pattern does not match. On 2026-09-22 seven consecutive builds were gated against a record that
 * started at 09:05; across the repo, 30 of 333 think.md files were invisible, the oldest from
 * 2026-08-19.
 *
 * The failure is silent in both directions — nothing downstream can tell "validated and fine"
 * from "never looked" — which is why it is pinned here rather than left to the parser looking
 * obviously correct.
 */
describe("frontMatter", () => {
  const body = ["started_at: 2026-09-22T12:58:10+08:00", "doc_integrity:", "  CLAUDE.md: 9dc4807"];

  it("THE REGRESSION — reads front matter written with CRLF line endings", () => {
    const md = ["---", ...body, "---", "", "# Heading"].join("\r\n");
    const fm = frontMatter(md);
    expect(fm).not.toBeNull();
    expect(fm.started_at).toBe("2026-09-22T12:58:10+08:00");
  });

  it("still reads LF, which is what the other 303 files use", () => {
    const md = ["---", ...body, "---", "", "# Heading"].join("\n");
    expect(frontMatter(md).started_at).toBe("2026-09-22T12:58:10+08:00");
  });

  it("reads a nested key the same way under CRLF", () => {
    // The nested branch trims, so it survived CRLF on its own — but only ever ran if the outer
    // match succeeded, so it was never exercised on a CRLF document.
    const md = ["---", ...body, "---"].join("\r\n");
    expect(frontMatter(md).doc_integrity).toEqual({ "CLAUDE.md": "9dc4807" });
  });

  it("returns null when there is no front matter at all", () => {
    // The null path must stay meaningful: it says "this document has none", not "I could not
    // parse the one it has".
    expect(frontMatter("# Just a heading\n\nProse.\n")).toBeNull();
  });
});
