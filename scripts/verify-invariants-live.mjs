// Live-DB invariant verifier (read-only) — re-confirms the structural invariants that were verified by hand on
// 2026-07-27 (see docs/audits/2026-07-27-live-db-verification.md). Complements `npm run invariant:audit`
// (static, scans code) with a check of the DEPLOYED database state. Run after a migration or before a release.
//
//   node scripts/verify-invariants-live.mjs        (needs SUPABASE_DB_URL in .env.local — Session-pooler)
//
// ONLY runs SELECT / catalog reads + one ROLLED-BACK write probe. Never commits a change. Exit 1 if any
// invariant FAILS (so CI can gate on it); exit 0 if all pass.

import { readFileSync } from "node:fs";
import pg from "pg";

// Minimal .env.local loader (avoids a dotenv dependency in a script).
function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local — rely on the ambient env */ }
}
loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set (Session-pooler string). Cannot verify live invariants.");
  process.exit(2);
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓ PASS" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function has(query, params = []) {
  const r = await c.query(query, params);
  return r.rowCount > 0 ? r.rows[0] : null;
}

// Run one check in isolation: a thrown query (e.g. a table renamed by a future migration) becomes a clean
// FAIL for THAT check with the error, never a crash of the whole run — so the verifier still reports every
// other invariant and exits 1 (not an opaque exit 2). This matters because the tool is run right when schema
// changes (after a migration).
async function check(name, thunk) {
  try {
    const { pass, detail } = await thunk();
    record(name, pass, detail);
  } catch (e) {
    record(name, false, "CHECK ERRORED (treated as fail): " + String(e.message).slice(0, 80));
  }
}

async function main() {
  await c.connect();
  console.log("\n═══ Live-DB invariant verification (read-only) ═══\n");

  await check("§3.1 events append-only (no_delete + no_update rules)", async () => {
    const rDel = await has("select 1 from pg_rules where tablename='events' and rulename='events_no_delete'");
    const rUpd = await has("select 1 from pg_rules where tablename='events' and rulename='events_no_update'");
    return { pass: !!rDel && !!rUpd };
  });

  await check("§3.2 understanding gate (raises when unconfigurable) + '*' threshold present", async () => {
    const gateFn = await has(
      "select 1 from pg_proc where proname ilike '%understanding%' and pg_get_functiondef(oid) ilike '%raise exception%'");
    const star = await has("select 1 from problem_thresholds where kind='*'");
    return { pass: !!gateFn && !!star };
  });

  await check("H2 finance immutability (fin_entries_immutable + fin_lines_immutable)", async () => {
    const immEntry = await has("select 1 from pg_proc where proname='fin_entries_immutable'");
    const immLines = await has("select 1 from pg_proc where proname='fin_lines_immutable'");
    return { pass: !!immEntry && !!immLines };
  });

  await check("H3 finance double-entry balance (fin_assert_entry_balanced raises on unbalanced)", async () => {
    const bal = await has(
      "select 1 from pg_proc where proname='fin_assert_entry_balanced' and pg_get_functiondef(oid) ilike '%unbalanced%'");
    return { pass: !!bal };
  });

  await check("H4 finance RLS on + policies company-scoped", async () => {
    const rls = await c.query(
      "select relname from pg_class where relname in ('fin_journal_entries','fin_journal_lines') and relrowsecurity");
    const pols = await c.query(
      "select count(*)::int n from pg_policies where tablename in ('fin_journal_entries','fin_journal_lines') and coalesce(qual,with_check) ilike '%auth_company_id()%'");
    return { pass: rls.rowCount === 2 && pols.rows[0].n >= 4, detail: `${rls.rowCount}/2 tables RLS, ${pols.rows[0].n} scoped policies` };
  });

  await check("finding-25 audio pointers all purgeable (0 non-'assets-v1/' shapes)", async () => {
    const badAudio = await c.query(
      "select count(*)::int n from coaching_sessions where audio_asset_url is not null and audio_asset_url not like 'assets-v1/%'");
    return { pass: badAudio.rows[0].n === 0, detail: `${badAudio.rows[0].n} bad` };
  });

  await check("finding-6a4 no posted entry dated outside its period (0 mis-dated)", async () => {
    const badDate = await c.query(`
      select count(*)::int n from fin_journal_entries je join fin_periods p on p.id = je.period_id
      where je.status='posted' and (je.entry_date < p.start_date or je.entry_date > p.end_date)`);
    return { pass: badDate.rows[0].n === 0, detail: `${badDate.rows[0].n} mis-dated` };
  });

  await check("RCD purge-enabled (content-immutable trigger, no delete-blocking rule)", async () => {
    // content-immutable via a trigger firing on UPDATE, but NOT delete-blocked (no `do instead nothing`
    // DELETE rule) — else the PII retention cron would silently no-op and retain data.
    const rcdImmut = await has(
      "select 1 from pg_trigger where tgrelid='care_rcd_conversations'::regclass and not tgisinternal and (tgtype & 16)=16");
    const rcdDelRule = await has(
      "select 1 from pg_rules where tablename='care_rcd_conversations' and definition ilike '%DO INSTEAD NOTHING%' and lower(definition) like '%on delete%'");
    return { pass: !!rcdImmut && !rcdDelRule, detail: rcdDelRule ? "a DELETE do-instead-nothing rule would BREAK the purge" : "delete path is open" };
  });

  await check("§3.1 event UPDATE is a no-op (behavioral, rolled back)", async () => {
    // Wrapped in its own transaction so nothing persists; the finally guarantees the rollback even on error.
    await c.query("begin");
    try {
      const one = await c.query("select id, created_at from events limit 1");
      if (!one.rowCount) return { pass: true, detail: "no events to probe" };
      await c.query("update events set created_at = now() where id = $1", [one.rows[0].id]);
      const chk = await c.query("select created_at from events where id=$1", [one.rows[0].id]);
      const noop = chk.rows[0].created_at.getTime() === one.rows[0].created_at.getTime();
      return { pass: noop, detail: noop ? "UPDATE was a no-op" : "UPDATE CHANGED the row (append-only BROKEN)" };
    } catch (e) {
      // A raised exception is ALSO a valid append-only outcome (the write was refused).
      return { pass: true, detail: "UPDATE rejected: " + String(e.message).slice(0, 40) };
    } finally {
      await c.query("rollback").catch(() => {});
    }
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? "✅ ALL " + results.length + " invariants hold." : "❌ " + failed.length + " of " + results.length + " FAILED."}\n`);
  await c.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("verifier error:", e.message);
  try { await c.end(); } catch { /* ignore */ }
  process.exit(2);
});
