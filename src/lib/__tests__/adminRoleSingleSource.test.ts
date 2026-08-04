import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Admin-role vocabulary-once guard (§A13 / A30 — encode the lesson in a gate).
 *
 * roles.ts authors the company-admin role set ONCE (ADMIN_ROLES / isAdminRole). The set was
 * historically re-inlined as `role === "CEO" || role === "COO" || role === "admin"` across ~12
 * authorization gates; if the set ever changes, an inline copy silently keeps the old rule — an authz
 * drift. Those were all swept to isAdminRole (2026-08-05) and the boundary was left CLEAN, so this pins
 * it: a comparison to the "CEO"/"COO" role literals may live ONLY in roles.ts. Those two names appear
 * only in company-leadership checks (unlike bare "admin", which sales_coach_role / chat role / topic
 * role legitimately use), so this is a high-precision signal for a re-inlined admin set.
 *
 * If you have a genuine CEO-or-COO-specific need (not the admin set), add a named helper to roles.ts and
 * use it — the point is that the role vocabulary lives in one place, not that the strings are forbidden.
 */
const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "../..");
const ROLES_FILE = join(SRC, "lib/roles.ts");

/** Recursively collect .ts/.tsx under src, excluding test files and roles.ts (the one legal home). */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && full !== ROLES_FILE) {
      acc.push(full);
    }
  }
  return acc;
}

// A comparison to the "CEO" or "COO" role literal, either operand order.
const INLINE_LEADER_LITERAL = /(===?\s*["'](?:CEO|COO)["'])|(["'](?:CEO|COO)["']\s*===?)/;

describe("company-admin role set stays single-source (roles.ts only)", () => {
  it("no source file outside roles.ts compares role to the CEO/COO literal (use isAdminRole)", () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => INLINE_LEADER_LITERAL.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f).replace(/\\/g, "/"));
    expect(
      offenders,
      `Inline CEO/COO role comparison found — route it through roles.ts (isAdminRole / a named helper):\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });
});
