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
