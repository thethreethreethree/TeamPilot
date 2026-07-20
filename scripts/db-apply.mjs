#!/usr/bin/env node
/**
 * scripts/db-apply.mjs — apply Supabase migrations from supabase/migrations/*.sql against the live DB.
 *
 * WHY THIS EXISTS: migrations 0001–0186 were applied piecemeal, by hand, across many sessions, with NO
 * ledger recording what is live. That history is the one landmine here — an apply tool that doesn't know
 * what's already applied will either re-run everything (fail loud, best case) or double-apply (corrupt,
 * worst case). So this script is built in four gated modes, safest first, and the write path literally
 * cannot run until a ledger baseline exists:
 *
 *   --check     PURE READ. Connect, report whether the ledger exists, and probe a few known-late objects
 *               (e.g. 0187's coaching_sessions.recording_saved) to infer the live head. Writes NOTHING.
 *   --baseline  Create the ledger table and mark every migration through a chosen head as "already applied
 *               (baselined)". Touches ONLY the ledger — never app schema. Run once, after --check confirms
 *               the live head. Refuses to run twice.
 *   --dry-run   List the migrations that WOULD apply (ledger vs. files on disk). Writes NOTHING.
 *   (apply)     Default. Apply each pending migration in its OWN transaction, record it in the ledger.
 *               A failure rolls that migration back and stops — no partial half-migration is left behind.
 *
 * CONNECTION: prefers SUPABASE_DB_URL (paste the one-line string from the Supabase dashboard → Settings →
 * Database → Connection string → "Session pooler"; it is IPv4 and includes host/region/port/password).
 * Falls back to constructing the DIRECT connection from SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD, which
 * is IPv6-only on most Supabase projects and may not route from a Windows box — --check will tell us.
 *
 * The ledger is `public._agent_migrations` (our own, NOT supabase's `schema_migrations`) so this tool never
 * fights the CLI's bookkeeping if the CLI is ever introduced. version = the numeric prefix, e.g. "0187".
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const MIGRATIONS_DIR = join(REPO, "supabase", "migrations");
const LEDGER = "_agent_migrations";

// ---- tiny .env.local loader (no dependency; we only read, never print, secrets) -----------------------
function loadEnv() {
  const p = join(REPO, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---- connection resolution ---------------------------------------------------------------------------
function resolveConnection() {
  if (process.env.SUPABASE_DB_URL) {
    return { source: "SUPABASE_DB_URL", connectionString: process.env.SUPABASE_DB_URL };
  }
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !pwd) {
    throw new Error(
      "No connection info. Set SUPABASE_DB_URL (dashboard → Settings → Database → Session pooler), " +
        "or provide SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD in .env.local."
    );
  }
  // Direct connection — IPv6-only on most projects; --check will reveal if it doesn't route.
  const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`;
  return { source: "constructed-direct (db.<ref>.supabase.co:5432)", connectionString };
}

// ---- migration files on disk -------------------------------------------------------------------------
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: f.match(/^(\d+)/)[1], name: f, path: join(MIGRATIONS_DIR, f) }));
}

async function ledgerExists(client) {
  const { rows } = await client.query(
    `select to_regclass('public.${LEDGER}') is not null as present`
  );
  return rows[0]?.present === true;
}

async function appliedVersions(client) {
  if (!(await ledgerExists(client))) return new Set();
  const { rows } = await client.query(`select version from public.${LEDGER}`);
  return new Set(rows.map((r) => String(r.version)));
}

// Probes to infer the live head WITHOUT a ledger — each returns true iff that migration's object exists.
// Ordered by version so the transition from present→absent brackets the live head. Tables use to_regclass
// (exact + reliable); columns use information_schema; policies use pg_policies with the ACTUAL name.
// NOTE (2026-07-20): the first cut of this list had two false "absent" results — 0141 queried table
// 'team_invites' (real name: team_invitations) and 0142 searched policy NAMES for 'created_by' (it lives in
// the with-check body). A probe that returns absent is a SUSPECT until its query is checked against the
// migration's actual object — verified below against each source file.
const PROBES = [
  { version: "0072", sql: `select 1 from information_schema.columns where table_name='profiles' and column_name='sales_coach_role'`, desc: "0072 profiles.sales_coach_role (col)" },
  { version: "0110", sql: `select 1 from information_schema.columns where table_name='profiles' and column_name='experience_mode'`, desc: "0110 profiles.experience_mode (col)" },
  { version: "0141", sql: `select 1 from pg_policies where tablename='team_invitations' and policyname='team_invitations - insert'`, desc: "0141 team_invitations insert policy" },
  { version: "0142", sql: `select 1 from information_schema.columns where table_name='fin_bills' and column_name='created_by' and column_default ilike '%auth.uid%'`, desc: "0142 fin_bills.created_by default=auth.uid()" },
  // NOTE: these MUST be `select 1 where <exists>` not `select <bool>` — a bare `select <bool>` returns one
  // row carrying false, and the harness counts rows, so it would read as present even when absent (caught
  // 2026-07-20 when 'fin_inventory', a table that does not exist, probed present). Existence must gate the row.
  // Dense NEW-TABLE bracket across the suspected head — new tables are uniquely introduced by their exact
  // migration, so unlike `create or replace function` they positively identify whether THAT migration ran.
  { version: "0143", sql: `select 1 where to_regclass('public.fin_credit_notes') is not null`, desc: "0143 table fin_credit_notes" },
  { version: "0149", sql: `select 1 where to_regclass('public.fin_budgets') is not null`, desc: "0149 table fin_budgets" },
  { version: "0150", sql: `select 1 where to_regclass('public.fin_tax_codes') is not null`, desc: "0150 table fin_tax_codes" },
  { version: "0151", sql: `select 1 where to_regclass('public.fin_year_closes') is not null`, desc: "0151 table fin_year_closes" },
  { version: "0158", sql: `select 1 where to_regclass('public.fin_payment_schedules') is not null`, desc: "0158 table fin_payment_schedules" },
  { version: "0159", sql: `select 1 where to_regclass('public.fin_dunning_policies') is not null`, desc: "0159 table fin_dunning_policies" },
  { version: "0160", sql: `select 1 where to_regclass('public.fin_corporate_cards') is not null`, desc: "0160 table fin_corporate_cards" },
  { version: "0162", sql: `select 1 where to_regclass('public.fin_expense_policies') is not null`, desc: "0162 table fin_expense_policies" },
  { version: "0166", sql: `select 1 where to_regclass('public.fin_fixed_assets') is not null`, desc: "0166 table fin_fixed_assets" },
  { version: "0167", sql: `select 1 where to_regclass('public.fin_payroll_runs') is not null`, desc: "0167 table fin_payroll_runs" },
  { version: "0168", sql: `select 1 where to_regclass('public.fin_approval_delegations') is not null`, desc: "0168 table fin_approval_delegations" },
  { version: "0169", sql: `select 1 where to_regclass('public.fin_opening_batches') is not null`, desc: "0169 table fin_opening_batches" },
  { version: "0171", sql: `select 1 where to_regclass('public.fin_report_definitions') is not null`, desc: "0171 table fin_report_definitions" },
  { version: "0172", sql: `select 1 where to_regclass('public.fin_report_schedules') is not null`, desc: "0172 table fin_report_schedules" },
  { version: "0180", sql: `select 1 where to_regclass('public.fin_inventory_items') is not null`, desc: "0180 table fin_inventory_items" },
  { version: "0187", sql: `select 1 from information_schema.columns where table_name='coaching_sessions' and column_name='recording_saved'`, desc: "0187 coaching_sessions.recording_saved (col)" },
];

async function probeHead(client) {
  const results = [];
  for (const p of PROBES) {
    let present = false;
    try {
      const { rowCount } = await client.query(p.sql);
      present = rowCount > 0;
    } catch (e) {
      present = false;
    }
    results.push({ ...p, present });
  }
  return results;
}

function connect(connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase requires TLS; its cert chain isn't in the local store.
    connectionTimeoutMillis: 15000,
    statement_timeout: 120000,
  });
  return client;
}

async function main() {
  loadEnv();
  const mode = process.argv[2] || "--help";
  const { source, connectionString } = resolveConnection();

  if (mode === "--help" || mode === "-h") {
    console.log(
      "Usage: node scripts/db-apply.mjs <mode>\n" +
        "  --check      pure read: connection + ledger + live-head probes (NO writes)\n" +
        "  --baseline=NNNN   create ledger, mark 0001..NNNN as baselined (ledger only)\n" +
        "  --dry-run    list migrations that would apply (NO writes)\n" +
        "  --apply      apply pending migrations, each in its own transaction\n"
    );
    return;
  }

  console.log(`[db-apply] connection source: ${source}`);
  const client = connect(connectionString);
  try {
    await client.connect();
  } catch (e) {
    console.error(`\n[db-apply] COULD NOT CONNECT: ${e.message}`);
    console.error(
      "If this is an IPv6/ENETUNREACH or timeout on the constructed direct URL, paste the IPv4 " +
        "'Session pooler' connection string from the Supabase dashboard into SUPABASE_DB_URL and retry.\n"
    );
    process.exitCode = 2;
    return;
  }

  try {
    const files = migrationFiles();
    console.log(`[db-apply] ${files.length} migration files on disk (through ${files.at(-1)?.version}).`);

    if (mode === "--check") {
      const hasLedger = await ledgerExists(client);
      console.log(`[db-apply] ledger public.${LEDGER}: ${hasLedger ? "PRESENT" : "ABSENT"}`);
      if (hasLedger) {
        const applied = await appliedVersions(client);
        console.log(`[db-apply] ledger records ${applied.size} applied migration(s).`);
      }
      console.log("[db-apply] live-head probes (infer what's applied when no ledger exists):");
      for (const r of await probeHead(client)) {
        console.log(`   ${r.present ? "✓ present" : "✗ absent "}  ${r.desc}`);
      }
      console.log(
        "\n[db-apply] READ-ONLY check complete. No writes were made. " +
          "If the probes show the expected head is live, run --baseline=<head> next."
      );
      return;
    }

    if (mode.startsWith("--baseline")) {
      const head = (mode.split("=")[1] || "").trim();
      if (!/^\d+$/.test(head)) {
        console.error("[db-apply] --baseline requires a head version, e.g. --baseline=0186");
        process.exitCode = 1;
        return;
      }
      if (await ledgerExists(client)) {
        console.error(
          `[db-apply] REFUSING: ledger public.${LEDGER} already exists. Baseline is a once-only operation.`
        );
        process.exitCode = 1;
        return;
      }
      await client.query(`
        create table public.${LEDGER} (
          version    text primary key,
          name       text not null,
          applied_at timestamptz not null default now(),
          baselined  boolean not null default false
        )
      `);
      const toMark = files.filter((f) => f.version <= head);
      for (const f of toMark) {
        await client.query(
          `insert into public.${LEDGER}(version, name, baselined) values ($1,$2,true) on conflict do nothing`,
          [f.version, f.name]
        );
      }
      console.log(
        `[db-apply] ledger created; marked ${toMark.length} migration(s) through ${head} as baselined ` +
          `(recorded as already-applied, NOT re-run). Pending from here: ${files.length - toMark.length}.`
      );
      return;
    }

    // --dry-run and --apply both need the applied set.
    const applied = await appliedVersions(client);
    if (applied.size === 0 && !(await ledgerExists(client))) {
      console.error(
        `\n[db-apply] NO LEDGER. Refusing to apply blind — run --check, then --baseline=<live head> first.\n`
      );
      process.exitCode = 1;
      return;
    }
    const pending = files.filter((f) => !applied.has(f.version));

    if (pending.length === 0) {
      console.log("[db-apply] nothing pending — DB is up to date with supabase/migrations/.");
      return;
    }

    console.log(`[db-apply] ${pending.length} pending migration(s):`);
    for (const f of pending) console.log(`   • ${f.name}`);

    if (mode === "--dry-run") {
      console.log("\n[db-apply] DRY RUN — nothing applied.");
      return;
    }

    if (mode !== "--apply") {
      console.error(`[db-apply] unknown mode '${mode}'. Use --check | --baseline=NNNN | --dry-run | --apply`);
      process.exitCode = 1;
      return;
    }

    // Apply each pending migration in its own transaction — a failure stops the run cleanly.
    for (const f of pending) {
      const sql = readFileSync(f.path, "utf8");
      process.stdout.write(`[db-apply] applying ${f.name} … `);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(
          `insert into public.${LEDGER}(version, name, baselined) values ($1,$2,false)`,
          [f.version, f.name]
        );
        await client.query("commit");
        console.log("ok");
      } catch (e) {
        await client.query("rollback").catch(() => {});
        console.log("FAILED (rolled back)");
        console.error(`\n[db-apply] ${f.name} failed: ${e.message}`);
        console.error("[db-apply] stopping. No partial migration was left applied.\n");
        process.exitCode = 1;
        return;
      }
    }
    console.log(`\n[db-apply] applied ${pending.length} migration(s). DB now at ${pending.at(-1).version}.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(`[db-apply] fatal: ${e.message}`);
  process.exitCode = 1;
});
