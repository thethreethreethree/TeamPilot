import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard for BOTH layers of the sensitive-IP rule in user-facing product UI:
 *   Layer 2 — internal methodology (§) citations (§3.1, §3.2, §A11, §4, …)
 *   Layer 1 — the methodology-doc filenames (CLAUDE.md, ThinkerThinker.md)
 * Both are fine in developer code comments, JSDoc route headers, and internal
 * LLM prompts, but NOT in any string a user or prospect can read. The
 * constitution / methodology docs are the product's IP moat.
 *
 * This locks the 2026-07-23 sweep that removed 24 such leaks (dashboard
 * subtitles, the sales demo, tooltips, placeholders, an extension panel message,
 * a literal "§4 readouts" heading). If it fails, a § citation has re-entered a
 * user-facing string — move the rationale into a code comment instead.
 *
 * Scope: JSX attribute values for known user-facing props + API/JSON response
 * fields. It deliberately does NOT flag § in `//`/`*` comments or in LLM system
 * prompts, which are not product surfaces.
 */

// User-facing strings live in the JSX surfaces (app + components). src/lib is
// deliberately out of scope: it holds no user-facing § today (verified), and
// its .ts files carry `=>` arrows + LLM system prompts that would false-positive
// the JSX-text pattern. The rule for lib is the same, enforced by review.
const ROOTS = ["src/app", "src/components"];

// § inside a user-facing JSX attribute value, e.g. subtitle="… §3.2 …"
const ATTR = /\b(subtitle|title|placeholder|aria-label|alt|label|hint|tooltip|description)\s*=\s*["'`][^"'`]*§/;
// § inside a user-facing response/JSON string field, e.g. message: "… §3.4 …"
const FIELD = /\b(message|error|note|reason|hint)\s*:\s*["'`][^"'`]*§/;
// § in JSX text between tags, e.g. >… §3.1 chain<  (require a section-like token after §)
const JSX_TEXT = />[^<>{}]*§[0-9A-Za-z]/;

// Layer 1 of the same IP rule: the methodology-doc FILENAMES must never appear
// in user-facing strings either (they're fine in developer code comments). Same
// user-facing contexts as above. No `=>` false-positive risk (plain filenames).
const DOC = /(subtitle|title|placeholder|aria-label|alt|label|hint|tooltip|description|message|error|note|reason)\s*[=:]\s*["'`][^"'`]*(thinkerthinker|claude\.md)/i;
const DOC_TEXT = />[^<>{}]*(thinkerthinker|claude\.md)/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...walk(p));
    } else if (/\.(tsx?|ts)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

describe("no sensitive-IP leaks (§ citations or methodology-doc filenames) in user-facing UI", () => {
  it("finds none across src/app and src/components", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      let files: string[];
      try {
        files = walk(root);
      } catch {
        continue; // root missing in some environments
      }
      for (const file of files) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (isCommentLine(line)) return;
          const hasCitation =
            line.includes("§") && (ATTR.test(line) || FIELD.test(line) || JSX_TEXT.test(line));
          const hasDocName = DOC.test(line) || DOC_TEXT.test(line);
          if (hasCitation || hasDocName) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(
      offenders,
      `§ methodology citations leaked into user-facing UI (move the rationale to a code comment):\n${offenders.join(
        "\n"
      )}`
    ).toEqual([]);
  });
});
