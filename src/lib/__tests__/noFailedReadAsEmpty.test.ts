import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A SCREEN MAY NOT TURN A FAILED READ INTO AN EMPTY ONE (2026-11-23).
 *
 * `fetch(url).then((r) => (r.ok ? r.json() : { review: null }))` answers a server error with exactly what "none yet"
 * looks like. Swept on 2026-11-23, that one shape had a coaching tab offering a PAID re-run of a review that existed,
 * a door goal form that wiped a saved value on save, "not enrolled" for an enrolled rep, and more. Every instance was
 * replaced with an explicit failed state; this keeps the shape from coming back. A route that answers "none" does so
 * with 200 + an empty value; a non-OK response is a failure and must be treated as one.
 */
const PATTERN = /r\.ok \? r\.json\(\) : \{[^}]*(null|\[\]|false)/;

/**
 * Deliberate fallbacks, each with its reason. Macro Mode off = the FULL module, which is always safe: a failed read can
 * only show more, never hide anything or invite a wrong action (the Remote Sales switch does the same, tested in
 * RemoteMacroToggle.render.test.tsx). Anything else must not be added here without a reason as strong.
 */
const ALLOWED: Record<string, string> = {
  "src/components/sales-coach/SalesCoachShell.tsx": "Macro Mode read fails → full sidebar (safe default)",
  "src/app/dashboard/sales-coach/page.tsx": "Macro Mode read fails → full dashboard (safe default)",
};

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no failed read is presented as an empty one", () => {
  it("the pattern catches the shape that caused it", () => {
    expect(PATTERN.test(".then((r) => (r.ok ? r.json() : { review: null }))")).toBe(true);
    expect(PATTERN.test(".then((r) => (r.ok ? r.json() : { drafts: [] }))")).toBe(true);
    expect(PATTERN.test(".then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))")).toBe(false);
  });

  it("no screen has it", () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const f of files(join(root, dir))) {
        readFileSync(f, "utf8").split("\n").forEach((line, i) => {
          const rel = relative(root, f);
          if (PATTERN.test(line) && !(rel in ALLOWED && /macro-mode|enabled: false/.test(line))) hits.push(`${rel}:${i + 1}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
