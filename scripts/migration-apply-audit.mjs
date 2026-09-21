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
//            June 2026 after 0021 and 0022 both failed live on "already exists". When this script
//            was written, 18 historical migrations were still not re-runnable and were recorded as
//            a BASELINE, on the reasoning that they had RUN in production and were therefore
//            append-only.
//
//            That baseline is now EMPTY (2026-09-21). The reasoning that filled it was sound about
//            the RECORD and wrong about the RISK: an unguarded migration is a thing somebody will
//            have to repair by hand, live, the first time it half-applies. A later migration cannot
//            fix an earlier one — on any replay 0001 still runs first, which was tested, not
//            assumed. So the guards went into the 18 files themselves, under a founder decision,
//            each edit headed by its reason. Any failure in this pass is now a real finding.
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
// EMPTY, 2026-09-21, and it took editing 18 applied migrations to get here.
//
// This list held 18 migrations that could not be re-run. A later migration cannot fix an
// earlier one — on any replay 0001 still runs first, which was tested rather than assumed:
// a repair migration left 0001 failing with the identical error. So the guards went into the
// files themselves, under a founder decision, with each edit headed by its reason.
//
// Keep it empty. An entry added here is a migration that will have to be fixed BY HAND, LIVE,
// the first time it half-applies — which is how 0021 and 0022 were found in June.
const NOT_RERUNNABLE_BASELINE = new Set([]);

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

// Returns null when reachable, otherwise WHY it was not.
//
// The reason it returns the reason: "SKIPPED — no reachable Postgres" is true of a machine with
// no Postgres and equally true of a running server whose role is named something else, and those
// two need completely different actions from the reader. Swallowing the probe's stderr made the
// skip banner a dead end — the same defect one level down as the skip itself, which is why this
// script exists. Found 2026-09-21 against a healthy postgres:16 container that reported
// `FATAL: role "postgres" does not exist` into a catch block.
function unreachableReason() {
  try {
    psql(["-d", MAINT_DB, "-c", "select 1"], "");
    return null;
  } catch (err) {
    const detail = String(err?.stderr ?? err?.message ?? err)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .find((l) => /error|fatal|could not|denied|refused|not exist/i.test(l));
    return detail ?? "psql exited non-zero and said nothing useful.";
  }
}

if (!existsSync(MIG_DIR) || !existsSync(SHIM)) {
  console.error("migration-apply-audit: run from the repo root.");
  process.exit(2);
}

console.log("═══ Migration apply audit — the whole history, against real Postgres ═══");

const unreachable = unreachableReason();
if (unreachable) {
  // Not a pass and not a failure. A developer without Postgres must not be blocked, and CI —
  // which always has one — must not be allowed to think this ran when it did not. Say which.
  console.log(`  SKIPPED — no reachable Postgres (tried maintenance db "${MAINT_DB}").`);
  console.log(`  psql said: ${unreachable}`);
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
