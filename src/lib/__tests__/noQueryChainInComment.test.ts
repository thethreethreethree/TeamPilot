import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * NO QUERY STEP MAY HIDE INSIDE A COMMENT (2026-11-23).
 *
 * The reps' weekly email counted "Deals" with `.eq("outcome", "sold").gte("created_at", since)` sitting at the end of
 * a `// …` comment on the line above — an edit appended the comment to a line that continued the chain. TypeScript
 * accepts it, lint accepts it, and the query simply runs without its filters: every in-person session ever, of any
 * outcome, became a deal this week. Silent by construction, so it gets a structural check.
 *
 * Flags a line whose `//` comment ends in `).method(…);` for a query-builder method — code that was meant to run.
 * Comments that QUOTE a chain do so in backticks, which the pattern excludes.
 */
const PATTERN = /\/\/[^`]*\)\.(eq|neq|in|is|gte|lte|gt|lt|like|ilike|or|not|order|limit|range|select|match|contains)\([^`]*\);\s*$/;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no query-builder chain is hidden inside a comment", () => {
  it("the pattern catches the line that caused it", () => {
    const bugged = `  .in("context", [...contextsOf("sales_coach")]) // Sales Coach: in-person only (0301, founder 2026-11-22).eq("outcome", "sold").gte("created_at", sinceIso);`;
    expect(PATTERN.test(bugged)).toBe(true);
    // …and leaves a comment that quotes a chain in backticks alone.
    expect(PATTERN.test("// (`.lte(\"start_date\", today).gte(\"end_date\", today)`) because it filters in the DB")).toBe(false);
  });

  it("no source file has one", () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const dir of ["src", "scripts"]) {
      for (const f of files(join(root, dir))) {
        readFileSync(f, "utf8").split("\n").forEach((line, i) => {
          if (PATTERN.test(line)) hits.push(`${relative(root, f)}:${i + 1}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
