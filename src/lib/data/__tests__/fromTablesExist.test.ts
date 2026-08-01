import { describe, it, expect } from "vitest";
import { collectMatches, allMigrationsSql } from "../../__tests__/_sourceScan";

/**
 * Every `.from("table")` in the code must reference a table or view that a migration creates. A
 * typo'd or renamed table with a lingering `.from()` is a runtime "relation does not exist" error
 * that typecheck can't catch (the name is a string literal). Collects every static `.from("...")`
 * name and asserts each is created (table, view, or materialized view) by some migration. Dynamic
 * `.from(variable)` calls are skipped (not statically resolvable).
 */
const tables = collectMatches(/\.from\(\s*"([a-z][a-z0-9_]+)"/g);
const migSql = allMigrationsSql();

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
