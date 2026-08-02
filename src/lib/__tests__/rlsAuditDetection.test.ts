import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * RLS-AUDIT DETECTION SELF-TEST — the one audit script (`scripts/rls-audit.mjs`) that lacked a self-test.
 *
 * An audit is only as trustworthy as its ability to FAIL. A security audit that has silently degraded into a
 * no-op (a regex that stopped matching, an early `exit(0)`) would go green on a real RLS gap and nobody would
 * know — the audit's own green is the signal everyone trusts. This test proves the audit still has teeth by
 * running it against synthetic fixtures with a KNOWN verdict, via the `RLS_AUDIT_DIR` override the script
 * exposes for exactly this purpose (rls-audit.mjs:53). It does NOT touch the 975-line script.
 *
 * Two directions, because a guard must both catch the bad AND pass the good:
 *   - a table created without `enable row level security` MUST be flagged (exit 1) — detection has teeth;
 *   - a fully-policied, tenant-pinned table MUST pass (exit 0) — the audit isn't a blanket always-fail.
 */
describe("rls-audit.mjs detection self-test", () => {
  const script = join(process.cwd(), "scripts", "rls-audit.mjs");
  let dir = "";

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  const runAgainst = (sql: string) => {
    dir = mkdtempSync(join(tmpdir(), "rls-audit-fixture-"));
    writeFileSync(join(dir, "0001_fixture.sql"), sql, "utf8");
    return spawnSync("node", [script], {
      env: { ...process.env, RLS_AUDIT_DIR: dir },
      encoding: "utf8",
    });
  };

  it("FLAGS a table created without `enable row level security` (exit 1) — detection has teeth", () => {
    const res = runAgainst(
      `create table fixture_no_rls (
         id uuid primary key default gen_random_uuid(),
         company_id uuid not null references companies(id)
       );`
    );
    expect(res.status, `expected a non-zero exit; stdout:\n${res.stdout}`).toBe(1);
    expect(res.stdout).toContain("fixture_no_rls");
    expect(res.stdout).toMatch(/without RLS|never .enable row level security/i);
  });

  it("FLAGS an RLS table missing per-operation policies (exit 1) — the silent-DELETE class", () => {
    // RLS is opt-in per operation: enabling RLS but only writing a SELECT policy silently denies
    // insert/update/delete (delete's failure mode returns success with 0 rows — the row survives).
    const res = runAgainst(
      `create table fixture_partial (
         id uuid primary key default gen_random_uuid(),
         company_id uuid not null references companies(id)
       );
       alter table fixture_partial enable row level security;
       create policy fp_sel on fixture_partial for select using (company_id = auth_company_id());`
    );
    expect(res.status, `expected a non-zero exit; stdout:\n${res.stdout}`).toBe(1);
    expect(res.stdout).toContain("fixture_partial");
    expect(res.stdout).toMatch(/insert.*update.*delete|Missing operations/i);
  });

  it("FLAGS a view without security_invoker (exit 1) — the RLS-bypassing-view class", () => {
    // A view without `with (security_invoker = true)` runs as its OWNER, so the querying user's RLS
    // policies are NOT applied to the base tables — a cross-tenant read the audit exists to catch.
    // Base table is fully policied so the VIEW is the only thing flagged.
    const res = runAgainst(
      `create table fixture_base (
         id uuid primary key default gen_random_uuid(),
         company_id uuid not null references companies(id)
       );
       alter table fixture_base enable row level security;
       create policy fb_sel on fixture_base for select using (company_id = auth_company_id());
       create policy fb_ins on fixture_base for insert with check (company_id = auth_company_id());
       create policy fb_upd on fixture_base for update using (company_id = auth_company_id()) with check (company_id = auth_company_id());
       create policy fb_del on fixture_base for delete using (company_id = auth_company_id());
       create view fixture_leaky_view as select id, company_id from fixture_base;`
    );
    expect(res.status, `expected a non-zero exit; stdout:\n${res.stdout}`).toBe(1);
    expect(res.stdout).toContain("fixture_leaky_view");
    expect(res.stdout).toMatch(/BYPASS RLS|security_invoker/i);
  });

  it("FLAGS an UPDATE policy that may not pin the tenant on write (exit 1) — the cross-tenant-move class", () => {
    // An UPDATE policy with a top-level OR in USING and no explicit `with check` reuses USING as the
    // new-row check; the OR branch can pass without pinning company_id, letting a caller move a row into
    // another tenant (the real files_update bug, fixed by 0154). Other ops fully policied so this is isolated.
    const res = runAgainst(
      `create table fixture_pin (
         id uuid primary key default gen_random_uuid(),
         company_id uuid not null references companies(id)
       );
       alter table fixture_pin enable row level security;
       create policy fp_sel on fixture_pin for select using (company_id = auth_company_id());
       create policy fp_ins on fixture_pin for insert with check (company_id = auth_company_id());
       create policy fp_del on fixture_pin for delete using (company_id = auth_company_id());
       create policy fp_upd on fixture_pin for update using (company_id = auth_company_id() or is_admin());`
    );
    expect(res.status, `expected a non-zero exit; stdout:\n${res.stdout}`).toBe(1);
    expect(res.stdout).toContain("fixture_pin");
    expect(res.stdout).toMatch(/pin the tenant|implicit check/i);
  });

  it("PASSES a fully-policied, tenant-pinned table (exit 0) — not a blanket always-fail", () => {
    const res = runAgainst(
      `create table fixture_secure (
         id uuid primary key default gen_random_uuid(),
         company_id uuid not null references companies(id)
       );
       alter table fixture_secure enable row level security;
       create policy fx_sel on fixture_secure for select using (company_id = auth_company_id());
       create policy fx_ins on fixture_secure for insert with check (company_id = auth_company_id());
       create policy fx_upd on fixture_secure for update using (company_id = auth_company_id()) with check (company_id = auth_company_id());
       create policy fx_del on fixture_secure for delete using (company_id = auth_company_id());`
    );
    expect(res.status, `expected a clean exit; stdout:\n${res.stdout}`).toBe(0);
    expect(res.stdout).toMatch(/Every table has RLS enabled/i);
  });
});
