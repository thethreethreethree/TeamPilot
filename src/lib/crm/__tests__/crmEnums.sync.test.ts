import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * CRM TS-union <-> Postgres-ENUM-TYPE drift guard.
 *
 * crm/types.ts declares six string-union types that its own header says "Match the migration at
 * 0049_crm_vendor_back_office.sql". The DB side is expressed as `create type <name> as enum (...)`,
 * NOT a `col in (...)` CHECK — so the existing enumConstraintSync guard (which regexes `col in (...)`)
 * does not cover these. A drift is the same class it guards: a TS value the DB enum lacks fails at
 * INSERT (a runtime 500), and a DB value the TS union lacks slips past exhaustive `switch`/narrowing
 * unhandled. This reads both files as text (the migration is the authoritative source) and asserts the
 * value SETS are identical.
 *
 * Adding a CRM enum? Add the (dbType, tsType) pair below — an unpaired enum on either side is itself a
 * drift this test should start catching.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(here, "../../../../supabase/migrations");
const TYPES = readFileSync(join(here, "../types.ts"), "utf8");

const migrationSql = (prefix: string): string => {
  const file = readdirSync(MIG_DIR).find((f) => f.startsWith(prefix));
  if (!file) throw new Error(`migration ${prefix}* not found`);
  return readFileSync(join(MIG_DIR, file), "utf8");
};
const SQL = migrationSql("0049");

/** Values of a Postgres `create type <name> as enum ( 'a', 'b' -- c\n )` block. */
function dbEnumValues(name: string): string[] {
  const body = SQL.match(new RegExp(`create type ${name} as enum\\s*\\(([\\s\\S]*?)\\)`, "i"))?.[1] ?? "";
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/** Values of a TS `export type <Name> = | "a" | "b";` union. */
function tsUnionValues(name: string): string[] {
  const body = TYPES.match(new RegExp(`export type ${name}\\s*=([\\s\\S]*?);`))?.[1] ?? "";
  return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

const PAIRS: Array<{ db: string; ts: string }> = [
  { db: "crm_lifecycle_stage", ts: "CrmLifecycleStage" },
  { db: "crm_account_source", ts: "CrmAccountSource" },
  { db: "crm_plan_tier", ts: "CrmPlanTier" },
  { db: "crm_subscription_status", ts: "CrmSubscriptionStatus" },
  { db: "crm_invoice_status", ts: "CrmInvoiceStatus" },
  { db: "crm_activity_kind", ts: "CrmActivityKind" },
];

describe("crm/types.ts unions stay in sync with the 0049 Postgres enum types", () => {
  for (const { db, ts } of PAIRS) {
    it(`${ts} <-> ${db} — both non-empty`, () => {
      expect(dbEnumValues(db).length, `db enum ${db}`).toBeGreaterThan(0);
      expect(tsUnionValues(ts).length, `ts union ${ts}`).toBeGreaterThan(0);
    });
    it(`${ts} <-> ${db} — value sets identical (drift = insert failure / unhandled narrowing)`, () => {
      expect(tsUnionValues(ts).slice().sort()).toEqual(dbEnumValues(db).slice().sort());
    });
  }
});
