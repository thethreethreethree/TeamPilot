#!/usr/bin/env node
// scripts/sql-harness.mjs — the claims that only executed SQL can check.
//
// WHY THIS EXISTS. Three builds on 2026-09-22 each closed with the same residual, in their own
// words:
//
//   · 0264's view `unreviewed_violation_flags` — "the TypeScript tests exercise a double of it,
//     not the view. A change to the view's WHERE clause would not fail a single unit test."
//   · `listFiles`' `!inner` embed — "asserted against a mock of the query builder, not against
//     PostgREST. A malformed embed string would fail at runtime with the suite green."
//   · `POST /api/team/departments` — "the authority check lives in RLS, deliberately. No test runs
//     as a non-admin and watches the write fail."
//
// Three builds naming the same missing capability is the class surfacing (A26). This is its home.
//
// ─── WHAT IT DELIBERATELY IS NOT ─────────────────────────────────────────────────────────────
//
// Not a database-testing framework. It has THREE named subjects, and the reason is A30: a gate
// must be precise or not exist. A general facility for "testing against Postgres" is a week of
// work whose first real use would still be these three.
//
// ─── THE DATABASE, AND WHY NOT THE OTHER ONE ─────────────────────────────────────────────────
//
// Its own, `sql_harness_scratch` — NOT `migration_audit_scratch`.
//
// That one is dropped and recreated by the migration audit on every run. Reading a database while
// another process rebuilds it produced a wrong policy count on 2026-09-22 that was reported to the
// founder as fact and had to be corrected: a partial answer to a counting query looks exactly like
// a complete one. A harness that races its own toolchain answers differently depending on what
// else is running, which is the opposite of what it is for.
//
// ─── THE COST, AND THE STALENESS KEY ─────────────────────────────────────────────────────────
//
// Replaying 264 migrations takes ~2 minutes, which is not affordable on every `npm run check`. So
// the database is built ONCE and kept, with a hash of the migration set stored inside it. A run
// rebuilds only when that hash has moved.
//
// The key is the harness's own version of the bug it exists to catch — compute it wrong and it
// tests yesterday's schema, confidently. So it hashes the NAMES AND CONTENTS of every migration
// file, not a count and not an mtime: a count misses an edit, and an mtime moves when nothing did.
//
// ─── SKIPPING ────────────────────────────────────────────────────────────────────────────────
//
// A skip that reads as a pass is the single most likely way this file causes harm — it would turn
// three honest residuals into three false assurances. So it says WHY, and it says it is not a
// pass, following `migration-apply-audit.mjs`, whose own comment records learning this:
//
//     "SKIPPED — no reachable Postgres" is true of a machine with no Postgres and equally true of
//     a running server whose role is named something else, and those two need completely
//     different actions from the reader.

import pg from "pg";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const MIG_DIR = "supabase/migrations";
const SHIM = "scripts/sql/supabase-shim.sql";
const DB = process.env.SQL_HARNESS_DB ?? "sql_harness_scratch";
// The same env vars the migration audit uses, deliberately — one source for how this repository
// reaches Postgres, rather than a parallel convention that drifts from it (§2.2).
const MAINT_DB = process.env.MIGRATION_AUDIT_MAINT_DB ?? process.env.PGDATABASE ?? "postgres";

/**
 * A connection string for `pg`, from the same environment the rest of the repo uses.
 *
 * `MIGRATION_AUDIT_PSQL` is a COMMAND ("docker exec -i ics-postgres psql -U ics"), not a URL, so
 * it is parsed for what `pg` needs: the -U role and, when the command runs through docker, the
 * container's mapped port on localhost. Anything it cannot infer falls back to libpq's own
 * defaults via PGHOST/PGUSER/PGPASSWORD, which is what CI sets.
 */
function connection(database) {
  const cmd = process.env.MIGRATION_AUDIT_PSQL ?? "";
  const user = /-U\s+(\S+)/.exec(cmd)?.[1] ?? process.env.PGUSER ?? "postgres";
  return {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user,
    password: process.env.PGPASSWORD ?? undefined,
    database,
  };
}

async function connect(database) {
  const c = new pg.Client(connection(database));
  await c.connect();
  return c;
}

/** Null when reachable, otherwise WHY — see the header. */
async function unreachableReason() {
  try {
    const c = await connect(MAINT_DB);
    await c.end();
    return null;
  } catch (e) {
    return String(e?.message ?? e).split("\n")[0];
  }
}

/** Names AND contents of every migration. A count misses an edit; an mtime moves when nothing did. */
function migrationKey() {
  const h = createHash("sha256");
  for (const f of readdirSync(MIG_DIR).filter((n) => n.endsWith(".sql")).sort()) {
    h.update(f);
    h.update(readFileSync(join(MIG_DIR, f)));
  }
  return h.digest("hex").slice(0, 32);
}

async function buildDatabase(key) {
  const maint = await connect(MAINT_DB);
  await maint.query(`drop database if exists ${DB}`);
  await maint.query(`create database ${DB}`);
  await maint.end();

  const c = await connect(DB);
  await c.query(readFileSync(SHIM, "utf8"));
  for (const f of readdirSync(MIG_DIR).filter((n) => n.endsWith(".sql")).sort()) {
    try {
      await c.query(readFileSync(join(MIG_DIR, f), "utf8"));
    } catch (e) {
      await c.end();
      throw new Error(`migration ${f} failed while building the harness database: ${e.message}`);
    }
  }
  await c.query(`create table if not exists _harness_meta (key text primary key, built_at timestamptz not null default now())`);
  await c.query(`delete from _harness_meta`);
  await c.query(`insert into _harness_meta (key) values ($1)`, [key]);
  await c.end();
}

/** The database, built if absent and rebuilt if the migration set moved. */
async function ensureDatabase() {
  const key = migrationKey();
  try {
    const c = await connect(DB);
    const { rows } = await c.query(`select key from _harness_meta limit 1`);
    await c.end();
    if (rows[0]?.key === key) return { built: false, key };
  } catch {
    /* absent or unreadable — rebuild below */
  }
  await buildDatabase(key);
  return { built: true, key };
}

/* ─── The claims ──────────────────────────────────────────────────────────────────────────── */

/**
 * Each claim gets a transaction of its own and is ROLLED BACK, including on failure. A claim that
 * leaked would make the next one depend on the order they happen to run in.
 */
async function claim(c, name, fn) {
  await c.query("begin");
  try {
    await fn();
    return { name, ok: true };
  } catch (e) {
    return { name, ok: false, why: String(e?.message ?? e).split("\n")[0] };
  } finally {
    await c.query("rollback");
  }
}

const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

/** A company + a rep + one scored pitch, seeded inside the caller's transaction. */
async function seedPitch(c, { violation = true } = {}) {
  await c.query(`set local session_replication_role = replica`);
  await c.query(`insert into companies (id, name) values ('a0000000-0000-4000-8000-000000000001','Harness Co')`);
  await c.query(
    `insert into pitch_scores (id, company_id, rep_id, recorded_at, rubric_version, qualifying, not_qualifying_reason)
     values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001', now(), 'v1', true, null)`
  );
  if (violation) {
    await c.query(
      `insert into pitch_score_events (company_id, pitch_id, type, item_id, points, evidence)
       values ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','violation','viol.rude',10,'harness')`
    );
  }
  await c.query(`set local session_replication_role = origin`);
}

async function run() {
  console.log("═══ SQL harness — the claims only executed SQL can check ═══");

  const unreachable = await unreachableReason();
  if (unreachable) {
    console.log(`  SKIPPED — no reachable Postgres (tried maintenance db "${MAINT_DB}").`);
    console.log(`  pg said: ${unreachable}`);
    console.log("  Set PGHOST / PGPORT / PGUSER / PGPASSWORD to reach one.");
    // NAMED BY THEIR DATABASE OBJECTS, not described. A reader who sees this skip needs to know
    // exactly what they are not being told, in terms they can go and check by hand.
    console.log("  THIS IS NOT A PASS. These claims went UNCHECKED:");
    console.log("    · unreviewed_violation_flags — an overridden flag must leave the view (0264)");
    console.log("    · unreviewed_violation_flags — security_invoker must still be set on it");
    console.log("    · profile_departments — the RLS policy must admit an admin and refuse a member");
    process.exit(0);
  }

  const { built, key } = await ensureDatabase();
  console.log(`  Database:  ${DB} (${built ? "rebuilt — the migration set moved" : "reused"}, key ${key.slice(0, 8)})`);

  const c = await connect(DB);
  const results = [];

  // ── CLAIM 1 — 0264's view is an anti-join, not a list of every violation ──────────────────
  results.push(
    await claim(c, "unreviewed_violation_flags excludes a flag that has an override", async () => {
      await seedPitch(c);
      const before = await c.query(`select count(*)::int as n from unreviewed_violation_flags`);
      must(before.rows[0].n === 1, `expected the unreviewed flag to be listed, saw ${before.rows[0].n}`);

      await c.query(`set local session_replication_role = replica`);
      await c.query(
        `insert into pitch_score_overrides (company_id, pitch_id, item_type, item_id, new_value, reason, actor_id)
         values ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','violation','viol.rude','removed','harness','c0000000-0000-4000-8000-000000000001')`
      );
      const after = await c.query(`select count(*)::int as n from unreviewed_violation_flags`);
      must(after.rows[0].n === 0, `an overridden flag must leave the view, saw ${after.rows[0].n}`);
    })
  );

  // ── CLAIM 2 — the view runs as the invoker, so RLS applies ────────────────────────────────
  //
  // A30's own incident is 19 views that read across the tenant boundary because this was missing.
  // `rls:audit` checks the migration TEXT; this checks the database.
  results.push(
    await claim(c, "the view is security_invoker in the database, not just in the migration", async () => {
      const { rows } = await c.query(
        `select reloptions from pg_class where relname = 'unreviewed_violation_flags'`
      );
      must(rows.length === 1, "the view does not exist");
      must(
        (rows[0].reloptions ?? []).includes("security_invoker=true"),
        `expected security_invoker=true, saw ${JSON.stringify(rows[0].reloptions)}`
      );
    })
  );

  // ── CLAIM 3 — profile_departments admits an admin and refuses everyone else ───────────────
  //
  // The department-assign route uses the caller-scoped client so this policy IS the authority
  // (§2.2). Nothing in that build's tests runs as a non-admin.
  results.push(
    await claim(c, "profile_departments admits an admin and refuses a member", async () => {
      await c.query(`set local session_replication_role = replica`);
      await c.query(`insert into auth.users (id) values ('d0000000-0000-4000-8000-000000000001'),('d0000000-0000-4000-8000-000000000002')`);
      await c.query(`insert into companies (id, name) values ('a0000000-0000-4000-8000-000000000002','Harness Co 2')`);
      await c.query(
        `insert into profiles (id, company_id, role) values
         ('d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','admin'),
         ('d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Member')`
      );
      await c.query(`insert into departments (id, company_id, name) values ('e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Harness Dept')`);
      await c.query(`set local session_replication_role = origin`);
      await c.query(`grant usage on schema auth to authenticated`);
      await c.query(`grant select, insert, update, delete on all tables in schema public to authenticated`);

      // As the ADMIN — must be allowed.
      await c.query(`set local role authenticated`);
      await c.query(`set local "request.jwt.claim.sub" = 'd0000000-0000-4000-8000-000000000001'`);
      await c.query(
        `insert into profile_departments (profile_id, department_id, assigned_by)
         values ('d0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001')`
      );

      // As the MEMBER — must be refused.
      await c.query(`set local "request.jwt.claim.sub" = 'd0000000-0000-4000-8000-000000000002'`);
      await c.query("savepoint s");
      let refused = false;
      try {
        await c.query(
          `insert into profile_departments (profile_id, department_id, assigned_by)
           values ('d0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002')`
        );
      } catch {
        refused = true;
      }
      await c.query("rollback to savepoint s");
      must(refused, "a Member was allowed to assign a department — the RLS policy is not holding");
    })
  );

  await c.end();

  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      ${r.why}`}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log(`\n✓ ${results.length} claim(s) checked against real Postgres.\n`);
    process.exit(0);
  }
  console.log(`\n✗ ${failed.length} of ${results.length} claim(s) failed against real Postgres.\n`);
  process.exit(1);
}

if (!existsSync(MIG_DIR) || !existsSync(SHIM)) {
  console.error("sql-harness: run from the repo root.");
  process.exit(2);
}

run().catch((e) => {
  console.error(`sql-harness: ${e?.message ?? e}`);
  process.exit(1);
});
