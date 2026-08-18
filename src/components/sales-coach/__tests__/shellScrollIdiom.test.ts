import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural guard for the Sales-Coach shell scroll idiom (render/usability class, founder-surfaced 2026-08-18).
 *
 * SalesCoachShell renders pages inside a `<main>` that is `flex-1 … overflow-hidden` — i.e. the viewport MINUS
 * the fixed bottom nav. A page/component sized to `min-h-screen` / `h-screen` (the whole viewport) is therefore
 * TALLER than main, and main's overflow-hidden CLIPS its bottom with no scrollbar. That is exactly how the Macro
 * Mode Door Log lost its "Record Pitch" button and the Report Card lost the bottom of its list. Every working
 * Sales Coach page uses `flex-1 … overflow-y-auto` (own your scroll region) instead — see the after-pitch page's
 * comment: "this matches every sibling Sales Coach page's scroll idiom (A21)".
 *
 * This guard fails if any Sales-Coach page or component reintroduces `min-h-screen` / `h-screen` in markup, so
 * the unusable-clip bug cannot come back silently. (Comment lines are ignored — the after-pitch page NAMES the
 * anti-pattern in a comment on purpose.)
 */

// Both fixed-overlay shells (SalesCoachShell + CareShell) render pages inside an overflow-hidden <main>, so
// both are subject to the clip. The main dashboard layout scrolls normally and is intentionally NOT covered.
const ROOTS = [
  "src/app/dashboard/sales-coach",
  "src/components/sales-coach",
  "src/app/dashboard/care",
  "src/components/care",
];
const BANNED = /\b(min-h-screen|h-screen)\b/;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function isComment(trimmed: string): boolean {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("{/*");
}

describe("Sales-Coach shell scroll idiom — no viewport-height roots (they clip inside the overflow-hidden shell)", () => {
  const files = ROOTS.flatMap(walk).filter((f) => !f.includes("__tests__"));

  it("scans a non-trivial number of Sales-Coach files (guard is actually wired)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no page/component uses min-h-screen or h-screen (use flex-1 + overflow-y-auto instead)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (isComment(line.trim())) return; // the anti-pattern is intentionally named in comments
        if (BANNED.test(line)) offenders.push(`${f.replace(/\\/g, "/")}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offenders, `viewport-height roots clip inside the shell — switch to "flex-1 min-h-0 overflow-y-auto":\n${offenders.join("\n")}`).toEqual([]);
  });
});
