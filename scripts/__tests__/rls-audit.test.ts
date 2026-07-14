import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Regression test for scripts/rls-audit.mjs — the CI-gated tenant-isolation check.
 *
 * Why this exists
 * ───────────────
 * rls-audit.mjs is a security gate: it runs in CI and fails a PR if any table enables
 * RLS but forgets a write policy, or is created without RLS at all. The gate is only
 * as trustworthy as its DETECTION logic — a well-meaning edit to a regex could make it
 * silently pass everything (fail-open), and nothing would notice because the real
 * migrations are (correctly) all clean. This test drives the script against fixture
 * SQL through the RLS_AUDIT_DIR override, so a broken detector fails HERE instead of
 * quietly disarming the gate in CI.
 *
 * It spawns the real script (not a reimplementation) so the test exercises exactly the
 * code that ships.
 */

function runAudit(files: Record<string, string>): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "rls-audit-fixture-"));
  try {
    for (const [name, sql] of Object.entries(files)) {
      writeFileSync(join(dir, name), sql);
    }
    try {
      const out = execFileSync("node", ["scripts/rls-audit.mjs"], {
        encoding: "utf8",
        env: { ...process.env, RLS_AUDIT_DIR: dir },
      });
      return { code: 0, out };
    } catch (e: unknown) {
      // execFileSync throws on non-zero exit; the error carries status + stdout.
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const tenantPolicies = (t: string) =>
  `alter table ${t} enable row level security;\n` +
  `create policy "${t} - all" on ${t} for all using ( company_id = auth_company_id() ) with check ( company_id = auth_company_id() );\n`;

describe("rls-audit.mjs (the tenant-isolation CI gate)", () => {
  it("passes a table with RLS enabled and full policy coverage", () => {
    const { code, out } = runAudit({
      "0001_ok.sql":
        `create table if not exists ok_tbl ( id uuid, company_id uuid );\n` +
        tenantPolicies("ok_tbl"),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/Every table has RLS enabled/i);
  });

  it("FAILS a table that enables RLS but is missing a write policy", () => {
    // select-only policy → insert/update/delete are silently denied and NOT allowlisted.
    const { code, out } = runAudit({
      "0001_gap.sql":
        `create table if not exists gap_tbl ( id uuid, company_id uuid );\n` +
        `alter table gap_tbl enable row level security;\n` +
        `create policy "gap_tbl - sel" on gap_tbl for select using ( company_id = auth_company_id() );\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/gap_tbl/);
    expect(out).toMatch(/insert|update|delete/);
  });

  it("FAILS (higher severity) a table CREATED but never RLS-enabled", () => {
    const { code, out } = runAudit({
      "0001_leak.sql": `create table if not exists leaky_tbl ( id uuid, company_id uuid );\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/without RLS/i);
    expect(out).toMatch(/leaky_tbl/);
  });

  it("does NOT mistake a create-table mention inside a SQL comment for a real table", () => {
    // The regex must require the opening `(`; a comment referencing the DDL is prose, not a table.
    const { code, out } = runAudit({
      "0001_comment.sql":
        `-- \`create table if not exists\` above is critical for idempotency\n` +
        `create table if not exists real_tbl ( id uuid, company_id uuid );\n` +
        tenantPolicies("real_tbl"),
    });
    expect(code).toBe(0);
    expect(out).not.toMatch(/\bif\b\s*$/m);
    expect(out).toMatch(/Every table has RLS enabled/i);
  });

  it("ignores a dropped table (no RLS finding for something that no longer exists)", () => {
    const { code } = runAudit({
      "0001_create.sql": `create table if not exists temp_tbl ( id uuid );\n`,
      "0002_drop.sql": `drop table if exists temp_tbl;\n`,
    });
    expect(code).toBe(0);
  });
});

/**
 * The implicit-WITH-CHECK trap (the real files_update bug, fixed by 0154).
 *
 * Postgres reuses an UPDATE policy's USING as its WITH CHECK when none is given. That's safe when
 * USING pins the tenant, but NOT when USING has a TOP-LEVEL `or` whose branch skips company_id —
 * the caller can then UPDATE a row they own into another tenant. These lock the detector: it must
 * FIRE on that shape, stay quiet on the safe shapes, and respect latest-definition-wins.
 */
describe("rls-audit tenant-pin check (implicit WITH CHECK trap)", () => {
  const table = (t: string) =>
    `create table if not exists ${t} ( id uuid, company_id uuid, uploader_id uuid );\n` +
    `alter table ${t} enable row level security;\n` +
    `create policy "${t} - sel" on ${t} for select using ( company_id = auth_company_id() );\n` +
    `create policy "${t} - ins" on ${t} for insert with check ( company_id = auth_company_id() );\n` +
    `create policy "${t} - del" on ${t} for delete using ( company_id = auth_company_id() );\n`;

  it("FIRES on a top-level OR with no explicit WITH CHECK (the files_update shape)", () => {
    const { code, out } = runAudit({
      "0001_leaky.sql":
        table("doc") +
        `create policy doc_update on doc for update using (\n` +
        `  uploader_id = auth.uid()\n` +
        `  or exists ( select 1 from profiles where id = auth.uid() and company_id = doc.company_id )\n` +
        `);\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/tenant-pin|pin the tenant/i);
    expect(out).toMatch(/doc_update/);
  });

  it("stays QUIET when the OR is nested inside exists() (the CARE/coaching role-choice shape)", () => {
    // The surrounding exists() still pins company_id, so the implicit check is safe. This is the
    // distinction that keeps the check at zero false positives on the real migrations.
    const { code, out } = runAudit({
      "0001_safe.sql":
        table("conv") +
        `create policy conv_update on conv for update using (\n` +
        `  exists ( select 1 from profiles p where p.id = auth.uid()\n` +
        `    and p.company_id = conv.company_id and ( p.is_support_agent or p.role in ('CEO','admin') ) )\n` +
        `);\n`,
    });
    expect(code).toBe(0);
    expect(out).toMatch(/pins the tenant on write/i);
  });

  it("stays QUIET when an explicit WITH CHECK is declared (author stated the new-row rule)", () => {
    const { code } = runAudit({
      "0001_explicit.sql":
        table("doc2") +
        `create policy doc2_update on doc2 for update using (\n` +
        `  uploader_id = auth.uid() or company_id = auth_company_id()\n` +
        `) with check ( company_id = auth_company_id() );\n`,
    });
    expect(code).toBe(0);
  });

  it("FIRES when an EXPLICIT with check never pins company_id (the after_pitch_summaries shape)", () => {
    // The table HAS company_id, and the check pins only the agent — so a caller can insert a row
    // stamped with another company's id. Distinct from the implicit trap: the check EXISTS, it just
    // forgets the tenant. This is the class 0155 fixed.
    const { code, out } = runAudit({
      "0001_unpinned.sql":
        `create table if not exists summary ( id uuid, company_id uuid, agent_id uuid );\n` +
        `alter table summary enable row level security;\n` +
        `create policy "summary - sel" on summary for select using ( company_id = auth_company_id() );\n` +
        `create policy "summary - upd" on summary for update using ( company_id = auth_company_id() );\n` +
        `create policy "summary - del" on summary for delete using ( company_id = auth_company_id() );\n` +
        `create policy "summary - ins" on summary for insert with check ( agent_id = auth.uid() );\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/company_id|tenant/i);
    expect(out).toMatch(/summary - ins/);
  });

  it("stays QUIET when the insert check DOES pin company_id", () => {
    const { code } = runAudit({
      "0001_pinned.sql":
        `create table if not exists summary2 ( id uuid, company_id uuid, agent_id uuid );\n` +
        `alter table summary2 enable row level security;\n` +
        `create policy "summary2 - sel" on summary2 for select using ( company_id = auth_company_id() );\n` +
        `create policy "summary2 - upd" on summary2 for update using ( company_id = auth_company_id() );\n` +
        `create policy "summary2 - del" on summary2 for delete using ( company_id = auth_company_id() );\n` +
        `create policy "summary2 - ins" on summary2 for insert\n` +
        `  with check ( agent_id = auth.uid() and company_id = auth_company_id() );\n`,
    });
    expect(code).toBe(0);
  });

  it("stays QUIET for a table with NO company_id column (nothing to pin — e.g. the file-join tables)", () => {
    // file_departments et al. are pure link tables; they carry no tenant column, so the rule
    // must not fire on them (they inherit scoping from the company-gated parent).
    const { code } = runAudit({
      "0001_link.sql":
        `create table if not exists link_tbl ( file_id uuid, tag text );\n` +
        `alter table link_tbl enable row level security;\n` +
        `create policy "link - sel" on link_tbl for select using ( exists (select 1 from files) );\n` +
        `create policy "link - ins" on link_tbl for insert with check ( exists (select 1 from files) );\n` +
        `create policy "link - upd" on link_tbl for update using ( exists (select 1 from files) );\n` +
        `create policy "link - del" on link_tbl for delete using ( exists (select 1 from files) );\n`,
    });
    expect(code).toBe(0);
  });

  it("FIRES on a SELECT that pins neither the tenant nor an identity (cross-tenant READ)", () => {
    // The highest-severity class: straight exfiltration. This test exists because the rule was
    // initially DEAD CODE — the policy regex didn't capture `for select`, so the check could never
    // run and the audit reported a reassuring green. A check that cannot fire is worse than none.
    const { code, out } = runAudit({
      "0001_leak.sql":
        `create table if not exists secrets ( id uuid, company_id uuid, owner_id uuid );\n` +
        `alter table secrets enable row level security;\n` +
        `create policy "secrets - sel" on secrets for select using ( is_some_role() );\n` +
        `create policy "secrets - ins" on secrets for insert with check ( company_id = auth_company_id() );\n` +
        `create policy "secrets - upd" on secrets for update using ( company_id = auth_company_id() );\n` +
        `create policy "secrets - del" on secrets for delete using ( company_id = auth_company_id() );\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/cross-tenant READ/i);
    expect(out).toMatch(/secrets - sel/);
  });

  it("accepts an IDENTITY-pinned SELECT (strictly narrower than a tenant pin)", () => {
    // `owner_id = auth.uid()` names no company_id, yet is SAFE: your identity belongs to exactly one
    // company, so "your own rows" is a strict subset of "your company's rows". This is why profiles /
    // dissect_topics / after_pitch_summaries are sound without naming the tenant.
    const { code } = runAudit({
      "0001_own.sql":
        `create table if not exists notes ( id uuid, company_id uuid, owner_id uuid );\n` +
        `alter table notes enable row level security;\n` +
        `create policy "notes - sel" on notes for select using ( owner_id = auth.uid() );\n` +
        `create policy "notes - ins" on notes for insert with check ( company_id = auth_company_id() );\n` +
        `create policy "notes - upd" on notes for update using ( company_id = auth_company_id() );\n` +
        `create policy "notes - del" on notes for delete using ( company_id = auth_company_id() );\n`,
    });
    expect(code).toBe(0);
  });

  it("honors latest-definition-wins: a later migration that adds WITH CHECK clears the finding", () => {
    // Exactly the 0057 -> 0154 sequence. Evaluating the superseded definition would report a bug
    // that a later migration already fixed.
    const { code } = runAudit({
      "0057_bug.sql":
        table("doc3") +
        `create policy doc3_update on doc3 for update using (\n` +
        `  uploader_id = auth.uid()\n` +
        `  or exists ( select 1 from profiles where id = auth.uid() and company_id = doc3.company_id )\n` +
        `);\n`,
      "0154_fix.sql":
        `drop policy if exists doc3_update on doc3;\n` +
        `create policy doc3_update on doc3 for update using (\n` +
        `  uploader_id = auth.uid()\n` +
        `  or exists ( select 1 from profiles where id = auth.uid() and company_id = doc3.company_id )\n` +
        `) with check ( company_id = auth_company_id() and uploader_id = auth.uid() );\n`,
    });
    expect(code).toBe(0);
  });
});

/**
 * VIEWS THAT BYPASS RLS.
 *
 * A Postgres view runs as its OWNER unless declared `with (security_invoker = true)`. Migrations run as
 * the owner — so a view without that option reads its base tables WITHOUT applying the querying user's RLS
 * policies. Any authenticated user selecting from it sees every company's rows.
 *
 * This is the leak the audit itself could not see: every underlying TABLE is correctly protected, so the
 * audit reported GREEN while the lens over those tables was wide open.
 *
 * The project had already learned this once (0052_views_security_invoker.sql) and codified it in a
 * migration — but never in a CHECK. So it was re-broken in sixteen views in a single session, and nothing
 * caught it. A lesson that lives only in a past migration is a lesson the next author re-learns the hard
 * way. These tests are that lesson made structural.
 */
describe("rls-audit.mjs — views that bypass RLS", () => {
  it("FAILS on a view created without security_invoker", () => {
    const { code, out } = runAudit({
      "0001_v.sql":
        "create table t (id uuid, company_id uuid);\n" +
        tenantPolicies("t") +
        "create or replace view t_summary as select company_id, count(*) from t group by company_id;\n",
    });
    expect(code).toBe(1);
    expect(out).toContain("t_summary");
    expect(out).toContain("BYPASS RLS");
  });

  it("PASSES a view declared with security_invoker inline", () => {
    const { code } = runAudit({
      "0001_v.sql":
        "create table t (id uuid, company_id uuid);\n" +
        tenantPolicies("t") +
        "create or replace view t_summary with (security_invoker = true) as select company_id from t;\n",
    });
    expect(code).toBe(0);
  });

  // The false-positive guard. 0052/0060/0071/0076 all create a view and then repair it with a separate
  // ALTER on a later line. A checker that only read the CREATE would flag all four — and an audit that
  // cries wolf on correct migrations is one people learn to skip, so the ONE real leak then rides in
  // behind six fake ones. (§A25: a false match is worse than a miss.)
  it("PASSES a view repaired by a later ALTER in the same migration", () => {
    const { code } = runAudit({
      "0001_v.sql":
        "create table t (id uuid, company_id uuid);\n" +
        tenantPolicies("t") +
        "create view t_summary as select company_id from t;\n" +
        "alter view t_summary set (security_invoker = true);\n",
    });
    expect(code).toBe(0);
  });

  it("PASSES a view repaired by a LATER migration (the 0048 → 0052 remediation shape)", () => {
    const { code } = runAudit({
      "0001_v.sql":
        "create table t (id uuid, company_id uuid);\n" +
        tenantPolicies("t") +
        "create or replace view t_summary as select company_id from t;\n",
      "0002_fix.sql": "alter view public.t_summary set (security_invoker = true);\n",
    });
    expect(code).toBe(0);
  });

  // Last statement wins: a view repaired once and then RECREATED without the option is leaking again.
  // This is the regression that 0071/0076 would have introduced had they not re-ALTERed.
  it("FAILS when a repaired view is later recreated without the option", () => {
    const { code, out } = runAudit({
      "0001_v.sql":
        "create table t (id uuid, company_id uuid);\n" +
        tenantPolicies("t") +
        "create view t_summary with (security_invoker = true) as select company_id from t;\n",
      "0003_regress.sql": "create or replace view t_summary as select company_id from t;\n",
    });
    expect(code).toBe(1);
    expect(out).toContain("t_summary");
  });
});
