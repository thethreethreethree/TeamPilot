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
