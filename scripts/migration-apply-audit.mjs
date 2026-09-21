#!/usr/bin/env node
//
// scripts/migration-apply-audit.mjs — apply the WHOLE migration history to a scratch Postgres.
//
// WHY THIS EXISTS
// ───────────────
// On 2026-09-21, migration 0252 created a `pitches` table that migration 0215 had already
// created three months earlier for a different feature. `create table if not exists` made the
// second one a silent no-op; the migration then died on a column that did not exist, meaning the
// entire Pitch Score system could never have deployed.
//
// It had been verified against real Postgres. Twice. With a hand-written prelude containing the
// tables the new migration REFERENCED — which, by construction, could not contain the one it
// collided with. That is the whole mechanism, and it is not fixable by being more careful: the
// more faithfully a prelude is derived from the migration under test, the more completely it
// guarantees that migration will pass.
//
// The only prelude that catches it is the real history. That is what this runs.
//
// TWO PASSES, and they are graded differently:
//
//   PASS 1 — fresh apply.  A migration that cannot apply to a database shaped like production is
//            a deployment blocker. Any failure here is FATAL.
//
//   PASS 2 — re-apply.  A12 ("migrations are safe-to-re-run by construction") was captured in
//            June 2026 after 0021 and 0022 both failed live on "already exists". 18 historical
//            migrations still are not re-runnable; they have RUN in production, so they are
//            append-only and must not be edited. They are recorded as a BASELINE below, and the
//            gate fails only when a NEW one appears. Fixing history is a separate build; stopping
//            the bleed is this one.
//
// Usage:
//   node scripts/migration-apply-audit.mjs                    # uses DATABASE_URL, or the env vars below
//   PGHOST=localhost PGUSER=postgres PGPASSWORD=… node scripts/migration-apply-audit.mjs
//
// Skips cleanly (exit 0) when no Postgres is reachable, so it never blocks a machine without one.
// CI provides a postgres service, so there it always runs.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const MIG_DIR = "supabase/migrations";
const SHIM = "scripts/sql/supabase-shim.sql";
const DB = process.env.MIGRATION_AUDIT_DB ?? "migration_audit_scratch";
// The database used to CREATE and DROP the scratch one. "postgres" exists on a stock server and
// in CI; it does not exist everywhere (a container whose POSTGRES_DB is something else has no
// `postgres` database at all), and assuming it made the first version of this script report
// SKIPPED on a machine that had Postgres running the whole time.
const MAINT_DB = process.env.MIGRATION_AUDIT_MAINT_DB ?? process.env.PGDATABASE ?? "postgres";

// ─── Historical migrations that are not safe to re-run ───────────────────────────────
//
// Every one is "policy/type/index already exists" — a `create` without a matching
// `drop … if exists`. They ran in production long ago and are append-only; editing them now
// would rewrite history to fix a problem that is already past. Recorded so a NEW one is visible.
const NOT_RERUNNABLE_BASELINE = new Set([
  "0001_init.sql",
  "0002_understanding_gate.sql",
  "0003_decision_dialogues.sql",
  "0004_events.sql",
  "0008_team_invitations.sql",
  "0010_team_chat.sql",
  "0016_chat_pins_delete_policy.sql",
  "0017_team_invitations_delete_policy.sql",
  "0018_feedback_and_smoke_tests.sql",
  "0049_crm_vendor_back_office.sql",
  "0135_fin_doc_summary_views.sql",
  "0149_fin_budgeting.sql",
  "0208_transcript_segments_unique_seq.sql",
  "0229_schedule_employee_admin_writes.sql",
  "0230_schedule_event_rls_rq6_and_manager_reads.sql",
  "0238_meeting_prep_up.sql",
  "0242_gamification_points_ledger.sql",
  "0244_gamification_calibration.sql",
]);

// How to invoke psql. Default is a psql on PATH; MIGRATION_AUDIT_PSQL overrides it with a
// space-separated command, which is how you point this at a container:
//
//   MIGRATION_AUDIT_PSQL="docker exec -i my-pg psql -U postgres" node scripts/migration-apply-audit.mjs
//
// Not a convenience. Without it this script cannot be RUN on a machine whose Postgres lives in
// Docker — which is most of them — and an unrunnable verifier is the thing A38 is about.
const PSQL_CMD = (process.env.MIGRATION_AUDIT_PSQL ?? "psql").split(/\s+/).filter(Boolean);

function psql(args, input) {
  const [bin, ...prefix] = PSQL_CMD;
  return execFileSync(bin, [...prefix, "-v", "ON_ERROR_STOP=1", "-q", ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function reachable() {
  try {
    psql(["-d", MAINT_DB, "-c", "select 1"], "");
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(MIG_DIR) || !existsSync(SHIM)) {
  console.error("migration-apply-audit: run from the repo root.");
  process.exit(2);
}

console.log("═══ Migration apply audit — the whole history, against real Postgres ═══");

if (!reachable()) {
  // Not a pass and not a failure. A developer without Postgres must not be blocked, and CI —
  // which always has one — must not be allowed to think this ran when it did not. Say which.
  console.log(`  SKIPPED — no reachable Postgres (tried maintenance db "${MAINT_DB}").`);
  console.log("  Set PGHOST / PGUSER / PGPASSWORD, or MIGRATION_AUDIT_PSQL to reach one in Docker,");
  console.log("  and MIGRATION_AUDIT_MAINT_DB when the maintenance database is not 'postgres'.");
  console.log("  This is not a pass. CI provides a postgres service, so it runs there.");
  process.exit(0);
}

const migrations = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();

psql(["-d", MAINT_DB, "-c", `drop database if exists ${DB}`], "");
psql(["-d", MAINT_DB, "-c", `create database ${DB}`], "");
psql(["-d", DB], readFileSync(SHIM, "utf8"));

const firstPass = [];
for (const name of migrations) {
  try {
    psql(["-d", DB], readFileSync(join(MIG_DIR, name), "utf8"));
  } catch (e) {
    const out = `${e.stderr ?? ""}${e.stdout ?? ""}`;
    firstPass.push({ name, error: (out.match(/ERROR:.*/) ?? ["(no ERROR line)"])[0].trim() });
  }
}

const rerun = [];
for (const name of migrations) {
  try {
    psql(["-d", DB], readFileSync(join(MIG_DIR, name), "utf8"));
  } catch (e) {
    const out = `${e.stderr ?? ""}${e.stdout ?? ""}`;
    rerun.push({ name, error: (out.match(/ERROR:.*/) ?? ["(no ERROR line)"])[0].trim() });
  }
}

const newlyNotRerunnable = rerun.filter((r) => !NOT_RERUNNABLE_BASELINE.has(r.name));
// A baseline entry that now re-runs cleanly is good news, and worth saying so the list shrinks
// rather than calcifying.
const fixedSinceBaseline = [...NOT_RERUNNABLE_BASELINE].filter(
  (n) => !rerun.some((r) => r.name === n)
);

console.log(`  Migrations applied:      ${migrations.length}`);
console.log(`  Failed on a fresh DB:    ${firstPass.length}`);
console.log(`  Not re-runnable (known): ${rerun.length - newlyNotRerunnable.length}`);
console.log(`  Not re-runnable (NEW):   ${newlyNotRerunnable.length}`);

if (firstPass.length) {
  console.log("");
  for (const f of firstPass) console.log(`✗ CANNOT APPLY  ${f.name}\n    ${f.error}`);
  console.log(
    "\n  A migration that cannot apply to a database shaped like production is a deployment\n" +
      "  blocker, whatever the tests say. The 2026-09-21 case: `create table if not exists` on a\n" +
      "  name another migration already used, which no amount of unit testing can see."
  );
}

if (newlyNotRerunnable.length) {
  console.log("");
  for (const f of newlyNotRerunnable) console.log(`✗ NOT RE-RUNNABLE  ${f.name}\n    ${f.error}`);
  console.log(
    "\n  A12: migrations are safe-to-re-run BY CONSTRUCTION, not merely run-once-cleanly. Use\n" +
      "  `drop policy if exists` before `create policy`, `if not exists` on indexes and types, and\n" +
      "  `create or replace` for functions and views. A migration that half-applies and cannot be\n" +
      "  re-run has to be fixed by hand, live, which is how 0021 and 0022 were found."
  );
}

if (fixedSinceBaseline.length) {
  console.log(
    `\n  ${fixedSinceBaseline.length} baseline entr${fixedSinceBaseline.length === 1 ? "y" : "ies"} now re-run cleanly — remove from NOT_RERUNNABLE_BASELINE: ` +
      fixedSinceBaseline.join(", ")
  );
}

if (firstPass.length === 0 && newlyNotRerunnable.length === 0) {
  console.log(
    `\n✓ All ${migrations.length} migrations apply to a database shaped like production, and no NEW` +
      " migration is non-re-runnable."
  );
  process.exit(0);
}
process.exit(1);
