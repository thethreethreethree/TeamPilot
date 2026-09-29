import { describe, it, expect } from "vitest";
import { splitFindings } from "../lib.mjs";

/**
 * 2026-09-29: a check.md with four findings, saved with CRLF (Windows autocrlf / Python text mode), was
 * reported as "records neither findings nor an explicit 'no findings' statement" — every `### ` heading kept
 * a trailing carriage return and the heading regex matched none of them.
 */
const md = (eol: string) =>
  ["# CHECK", "", "### First finding", "class: a", "sweep: grep x", "severity: high", "", "### Second", "class: b"].join(eol);

type Section = { title: string; body: string };

describe("splitFindings", () => {
  it("finds every ### section with LF endings", () => {
    expect((splitFindings(md("\n")) as Section[]).map((f) => f.title)).toEqual(["First finding", "Second"]);
  });

  it("finds the same sections with CRLF endings — the Windows checkout", () => {
    const got = splitFindings(md("\r\n")) as Section[];
    expect(got.map((f) => f.title)).toEqual(["First finding", "Second"]);
    expect(got[0]!.body).toMatch(/(^|\n)\s*severity\s*:\s*high/);
  });
});
