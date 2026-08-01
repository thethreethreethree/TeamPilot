import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * BrainRecord (brain/types.ts) is the TS mirror of the company_brain row (migration 0007). Its own
 * comment: "All fields mirror migration 0007. If 0007 changes, this type must change too — the SQL
 * column types are the truth, this is the TS mirror." Nothing enforced it. The dangerous direction:
 * a BrainRecord field with NO matching company_brain column reads `undefined` at runtime — and the
 * brain is composed into the system prompt of EVERY LLM call for that company, so a silently-missing
 * field degrades every AI reply. (The reverse — a column with no field, e.g. created_at — is a
 * deliberate omission, so this only asserts type-field -> column, not the other way.)
 */
const here = dirname(fileURLToPath(import.meta.url));
const typesSrc = readFileSync(join(here, "../types.ts"), "utf8");
const migDir = join(here, "../../../../supabase/migrations");
const migFile = readdirSync(migDir).find((f) => f.startsWith("0007"));
if (!migFile) throw new Error("migration 0007 not found");
const migSrc = readFileSync(join(migDir, migFile), "utf8");

const snake = (s: string) => s.replace(/([A-Z])/g, "_$1").toLowerCase();

// Top-level field names of `export type BrainRecord = { ... };`.
const recordBlock =
  typesSrc.match(/export type BrainRecord = \{([\s\S]*?)\n\};/)?.[1] ?? "";
const recordFields = [...recordBlock.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);

// Column names inside `create table if not exists company_brain ( ... );`.
const tableBlock =
  migSrc.match(/create table if not exists company_brain \(([\s\S]*?)\n\);/i)?.[1] ?? "";
const columns = new Set(
  [...tableBlock.matchAll(/^\s+(\w+)\s+/gm)].map((m) => m[1])
);

describe("BrainRecord type stays in sync with the company_brain schema (0007)", () => {
  it("parsed both the type fields and the table columns", () => {
    expect(recordFields.length).toBeGreaterThan(3);
    expect(columns.size).toBeGreaterThan(3);
  });

  it("every BrainRecord field maps to a company_brain column (no field reads undefined)", () => {
    const orphans = recordFields
      .map((f) => snake(f as string))
      .filter((f) => !columns.has(f));
    expect(
      orphans,
      `BrainRecord fields with no matching company_brain column: [${orphans.join(", ")}]`
    ).toEqual([]);
  });
});
