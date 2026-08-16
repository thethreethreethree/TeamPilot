import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VENDOR_COMPANY_ID } from "../vendorCompanyId";

/**
 * Vendor-company-id drift guard (audit 2026-08-16, finding #7).
 *
 * The vendor/home-company id lives in TWO layers that must agree: the app constant
 * `VENDOR_COMPANY_ID` (crm/vendorCompanyId.ts — feeds requireVendorAdmin at the route layer) and the
 * DB function `is_vendor_super_admin()` (migration 0089 — the RLS-side gate for crm_* AND the 0214
 * vendor_monitoring_* tables). If they drift, the route layer and the DB layer disagree about who the
 * vendor is: e.g. the founders could pass the route gate but be denied by RLS on the monitoring tables
 * (or vice-versa). 0089's own comment says to hand-edit its literal on a home-company change; nothing
 * enforced that. This does. Static text scan — no DB or import of the server-only module needed.
 */
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "..", "..", "supabase", "migrations");

function readVendorSuperAdminMigration(): string {
  const file = readdirSync(migrationsDir).find((f) =>
    /_harden_vendor_super_admin/.test(f)
  );
  if (!file) throw new Error("0089 vendor-super-admin migration not found");
  return readFileSync(join(migrationsDir, file), "utf8");
}

describe("vendor company id stays in sync between the app constant and is_vendor_super_admin() (0089)", () => {
  it("the UUID hardcoded in is_vendor_super_admin() equals VENDOR_COMPANY_ID", () => {
    const sql = readVendorSuperAdminMigration();
    // The function body pins: `and p.company_id = '<uuid>'::uuid`
    const m = sql.match(/company_id\s*=\s*'([0-9a-fA-F-]{36})'/);
    expect(m, "0089 must pin p.company_id to a UUID literal").toBeTruthy();
    expect(m![1]).toBe(VENDOR_COMPANY_ID);
  });
});
