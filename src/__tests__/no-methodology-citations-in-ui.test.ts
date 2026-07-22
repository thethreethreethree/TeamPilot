import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard: internal methodology (§) citations must never appear in customer-facing
 * product UI. The constitution / methodology docs are sensitive IP — their
 * section labels (§3.1, §3.2, §A11, §4, …) are fine in developer code comments,
 * JSDoc route headers, and internal LLM prompts, but NOT in strings a user or
 * prospect can read.
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

const ROOTS = ["src/app", "src/components"];

// § inside a user-facing JSX attribute value, e.g. subtitle="… §3.2 …"
const ATTR = /\b(subtitle|title|placeholder|aria-label|alt|label|hint|tooltip|description)\s*=\s*["'`][^"'`]*§/;
// § inside a user-facing response/JSON string field, e.g. message: "… §3.4 …"
const FIELD = /\b(message|error|note|reason|hint)\s*:\s*["'`][^"'`]*§/;
// § in JSX text between tags, e.g. >… §3.1 chain<  (require a section-like token after §)
const JSX_TEXT = />[^<>{}]*§[0-9A-Za-z]/;

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

describe("no methodology (§) citations in user-facing UI", () => {
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
          if (!line.includes("§")) return;
          if (ATTR.test(line) || FIELD.test(line) || JSX_TEXT.test(line)) {
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
