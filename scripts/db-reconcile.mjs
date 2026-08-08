#!/usr/bin/env node
/**
 * db-reconcile.mjs — READ-ONLY ledger drift detector (no writes ever persist).
 *
 * WHY (2026-08-09): migration 0208 was applied to prod BY HAND (an urgent hotfix) without going through
 * `db:apply`, so the ledger (_agent_migrations) never recorded it. The next `db:apply` then tried to re-run it
 * and failed with a cryptic "relation already exists", blocking an unrelated migration (0209). This tool makes
 * that drift VISIBLE on demand instead of surfacing as a mid-apply error.
 *
 * It classifies every migration file that is NOT in the ledger:
 *   DRIFTED — running it errors "already exists" (its objects are live → it was applied off-ledger). Fix:
 *             record it in the ledger (a targeted insert with baselined=true), do NOT re-run it.
 *   PENDING — it applies cleanly (genuinely not yet applied). `db:apply` will handle it normally.
 *   ERROR   — some other failure (e.g. a rolled-back dependency); classify by hand.
 * Also reports ORPHAN ledger rows (a version recorded with no matching file).
 *
 * MECHANISM: one transaction, a savepoint per file; a clean apply RELEASEs the savepoint (so a later dependent
 * migration sees it), a failure ROLLBACKs to the savepoint (recovering the tx) and is classified. The whole
 * transaction is ROLLED BACK at the end — identical safety to `db:verify`. Same in-transaction caveat as
 * db:verify (a statement that cannot run in a tx would show as ERROR, not a real apply).
 *
 * Exit code: 1 if any DRIFT or ORPHAN is found (so it can gate CI later), else 0. Read-only; safe to run anytime.
 */
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(REPO, "supabase", "migrations");
const LEDGER = "_agent_migrations";

// Tiny .env.local loader (mirrors db-apply.mjs; reads, never prints, secrets).
function loadEnv() {
  try {
    const txt = readFileSync(join(REPO, ".env.local"), "utf-8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) {
        const k = m[1];
        const v = m[2].replace(/^["']|["']$/g, "");
        if (!(k in process.env)) process.env[k] = v;
      }
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (ref && pwd) {
    return `postgresql://postgres:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`;
  }
  throw new Error("No connection info. Set SUPABASE_DB_URL in .env.local (dashboard → Settings → Database).");
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .map((f) => ({ version: f.match(/^(\d+)/)[1], name: f, path: join(MIGRATIONS_DIR, f) }))
    .sort((a, b) => Number(a.version) - Number(b.version));
}

const DRIFT_RE = /already exists|duplicate|already a member of|multiple primary keys/i;

async function main() {
  loadEnv();
  const files = migrationFiles();
  const client = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(`select version from public.${LEDGER}`);
    const ledger = new Set(rows.map((r) => String(r.version)));
    const fileVers = new Set(files.map((f) => f.version));
    const unrecorded = files.filter((f) => !ledger.has(f.version));
    const orphans = [...ledger].filter((v) => !fileVers.has(v)).sort();

    const drifted = [];
    const pending = [];
    const errored = [];

    if (unrecorded.length) {
      await client.query("begin");
      for (const f of unrecorded) {
        await client.query("savepoint sp");
        try {
          await client.query(readFileSync(f.path, "utf-8"));
          await client.query("release savepoint sp"); // keep effects visible to later dependents
          pending.push(f.name);
        } catch (e) {
          await client.query("rollback to savepoint sp"); // recover the aborted tx, discard this file
          const msg = e.message || String(e);
          (DRIFT_RE.test(msg) ? drifted : errored).push({ name: f.name, err: msg });
        }
      }
      await client.query("rollback"); // nothing persists — read-only by construction
    }

    console.log(`[db-reconcile] ${files.length} file(s) on disk, ${ledger.size} ledger row(s).`);
    console.log(`[db-reconcile] ${unrecorded.length} not in ledger → ${drifted.length} DRIFTED, ${pending.length} PENDING, ${errored.length} ERROR.`);
    if (drifted.length) {
      console.log("\n  DRIFTED (applied off-ledger — record in the ledger, do NOT re-run):");
      for (const d of drifted) console.log(`    • ${d.name}  (${d.err.split("\n")[0]})`);
    }
    if (pending.length) {
      console.log("\n  PENDING (genuinely not applied — `npm run db:apply` will handle):");
      for (const p of pending) console.log(`    • ${p}`);
    }
    if (errored.length) {
      console.log("\n  ERROR (could not classify — inspect by hand, e.g. a rolled-back dependency):");
      for (const e of errored) console.log(`    • ${e.name}  (${e.err.split("\n")[0]})`);
    }
    if (orphans.length) {
      console.log("\n  ORPHAN ledger rows (recorded version with no file):");
      for (const o of orphans) console.log(`    • ${o}`);
    }

    const bad = drifted.length > 0 || orphans.length > 0;
    console.log(bad ? "\n[db-reconcile] DRIFT DETECTED — reconcile before the next apply." : "\n[db-reconcile] ✓ ledger consistent with the migration files.");
    process.exitCode = bad ? 1 : 0;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`[db-reconcile] failed: ${e.message || e}`);
  process.exitCode = 2;
});
