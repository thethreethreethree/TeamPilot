import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_ROLES } from "@/lib/roles";

/**
 * Escalation-gate drift-guard (§2.2 / A40).
 *
 * The team_invitations INSERT RLS policy (0141, re-created in 0239) gates ADMIN-role invites behind
 * "caller is already an admin" — because accepting a CEO/CFO/COO invite grants company-admin (0114).
 * That policy HARDCODES the admin role set in SQL: it re-derives ADMIN_ROLES rather than consuming it.
 * A40 warns this copy drifts — the CFO escalation this migration fixes is exactly that class (CFO was
 * added to ADMIN_ROLES but the 0141 copy still said only CEO/COO). This test pins the SQL copy to the
 * canonical roles.ts ADMIN_ROLES so any future admin-tier addition MUST update the policy in lockstep,
 * or the build goes red here (not silently at a live escalation).
 *
 * The two SQL terms and what they must equal:
 *   - `p.role in (...)`   (the caller-admin check)        == ADMIN_ROLES            {CEO,CFO,COO,admin}
 *   - `role not in (...)` (the invitable-admin exclusion) == ADMIN_ROLES \ {admin}  {CEO,CFO,COO}
 *     ('admin' is the onboarding-only bootstrap role — never invitable, so it's not in the exclusion.)
 *
 * REPIN the migration prefix below if a later migration re-creates this policy.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIG = join(here, "../../../supabase/migrations/0239_team_invite_tier_roles.sql");

/** Extract the quoted list from the first match of `pattern` in the SQL. */
function sqlRoleList(sql: string, pattern: RegExp): string[] {
  const m = sql.match(pattern);
  return (m?.[1] ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

describe("invite-role escalation gate (0239 RLS) stays synced to ADMIN_ROLES", () => {
  const sql = readFileSync(MIG, "utf8");
  const adminSet = [...ADMIN_ROLES].sort();
  const invitableAdminSet = [...ADMIN_ROLES].filter((r) => r !== "admin").sort();

  it("the caller-admin check `p.role in (...)` equals ADMIN_ROLES", () => {
    const list = sqlRoleList(sql, /p\.role\s+in\s*\(([^)]+)\)/i);
    expect(list.sort()).toEqual(adminSet);
  });

  it("the invitable-admin exclusion `role not in (...)` equals ADMIN_ROLES minus 'admin'", () => {
    const list = sqlRoleList(sql, /role\s+not\s+in\s*\(([^)]+)\)/i);
    expect(list.sort()).toEqual(invitableAdminSet);
  });

  it("the exclusion never contains the onboarding 'admin' bootstrap role", () => {
    const list = sqlRoleList(sql, /role\s+not\s+in\s*\(([^)]+)\)/i);
    expect(list).not.toContain("admin");
  });
});
