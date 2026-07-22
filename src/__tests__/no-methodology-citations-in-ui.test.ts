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

// app + components get the FULL pattern set (JSX attrs, response fields, JSX text).
// src/lib gets FIELD + DOC only: user-facing strings CAN originate there (a route
// returns a lib-built `reason`/`message` to the client — that's how the §3.4
// control-gate message leaked, fixed 2026-07-23), but its .ts files carry `=>`
// arrows + LLM system prompts that would false-positive the JSX-text pattern, and
// FIELD (`message|reason: "…§"`) has no such risk.
const FULL_ROOTS = ["src/app", "src/components"];
const LIB_ROOTS = ["src/lib"];

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

function scan(roots: string[], check: (line: string) => boolean): string[] {
  const offenders: string[] = [];
  for (const root of roots) {
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
        if (check(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  return offenders;
}

describe("no sensitive-IP leaks (§ citations or methodology-doc filenames) in user-facing UI", () => {
  it("finds none across app/components (full patterns) or lib (field patterns)", () => {
    const offenders = [
      // JSX surfaces: attrs, response fields, JSX text, and doc-name variants.
      ...scan(
        FULL_ROOTS,
        (line) =>
          (line.includes("§") && (ATTR.test(line) || FIELD.test(line) || JSX_TEXT.test(line))) ||
          DOC.test(line) ||
          DOC_TEXT.test(line)
      ),
      // lib: only FIELD (message/reason/error string values) + doc-name-in-field.
      // No JSX_TEXT (`>…` matches `=>` arrows) and no ATTR (lib has no JSX props).
      ...scan(LIB_ROOTS, (line) => (line.includes("§") && FIELD.test(line)) || DOC.test(line)),
    ];
    expect(
      offenders,
      `§ methodology citations / doc filenames leaked into user-facing strings (move the rationale to a code comment):\n${offenders.join(
        "\n"
      )}`
    ).toEqual([]);
  });
});
