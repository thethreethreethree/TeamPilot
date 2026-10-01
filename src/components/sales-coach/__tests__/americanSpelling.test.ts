import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The website speaks American English, as the app does (founder, REV 1: "americans use c over s").
 *
 * Mirrors the app's tests/american-spelling.test.ts. On 2026-10-01 the website had "practise" on the
 * after-pitch screen, "Reps practising" on Training, and "cost centre" four times in Finance (whose own field
 * is `cost_center`). Every .tsx a person sees is read with its comments blanked; tests and captures are
 * skipped. "Analyses" is not on the list: it is the American plural of "analysis".
 */
const BRITISH =
  /\b(analys(e|ed|ing)|recognis(e|ed|es|ing)|practis(e|ed|es|ing)|organis(e|ed|ing)|summaris(e|ed|ing)|apologis(e|ed|ing)|favourite|centre|colour|behaviour)\b/i;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__" && name !== "captures") out.push(...files(p));
    } else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Blank every comment but keep its line breaks, so a reported line number is the real one. */
const keepLines = (c: string) => c.replace(/[^\n]/g, " ");
const withoutComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, keepLines)
    .replace(/\/\*[\s\S]*?\*\//g, keepLines)
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, pre: string) => pre + keepLines(m.slice(pre.length)));

describe("American spelling in what a person reads", () => {
  it("has no British forms in any screen", () => {
    const found: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      withoutComments(readFileSync(f, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          const m = BRITISH.exec(line);
          // className tokens and identifiers are code, not words.
          if (m && !/className=|\bconst |\bfunction |\bimport /.test(line)) {
            found.push(`${f.slice(process.cwd().length + 1)}:${i + 1} "${m[0]}"`);
          }
        });
    }
    expect(found).toEqual([]);
  });
});
