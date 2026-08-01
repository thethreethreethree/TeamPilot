import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every `.from("table")` in the code must reference a table or view that a migration creates. A
 * typo'd or renamed table with a lingering `.from()` is a runtime "relation does not exist" error
 * that typecheck can't catch (the name is a string literal). Collects every static `.from("...")`
 * name and asserts each is created (as a table, view, or materialized view) by some migration.
 * Dynamic `.from(variable)` calls are skipped (not statically resolvable).
 */
const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "../../.."); // -> src/
const MIG_DIR = join(here, "../../../../supabase/migrations");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "__tests__" || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const tables = new Set<string>();
for (const f of walk(SRC)) {
  for (const m of readFileSync(f, "utf8").matchAll(/\.from\(\s*"([a-z][a-z0-9_]+)"/g)) {
    if (m[1]) tables.add(m[1]);
  }
}

const migSql = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(MIG_DIR, f), "utf8"))
  .join("\n");

const missing = [...tables].filter(
  (t) =>
    !new RegExp(
      `create\\s+(table|(or\\s+replace\\s+)?view|materialized\\s+view)(\\s+if\\s+not\\s+exists)?\\s+(public\\.)?${t}\\b`,
      "i"
    ).test(migSql)
);

describe("every .from('table') resolves to a table/view created in a migration", () => {
  it("the scan actually found the .from() calls (sanity)", () => {
    expect(tables.size).toBeGreaterThan(50);
  });

  it("no .from() references a table/view that no migration creates (no 'relation does not exist')", () => {
    expect(missing, `.from() names with no CREATE in migrations: ${missing.join(", ")}`).toEqual([]);
  });
});
