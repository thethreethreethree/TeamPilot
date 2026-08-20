// One-off remediation (2026-08-21, founder-approved): consolidate 5 duplicate "Align Sales Pros"/"ASP" company
// records into the canonical oldest one (28203036). Re-points sessions + rep-data + agent profiles; removes the
// duplicates from the monitoring scope; renames them. DRY-RUN by default (runs the writes in a txn + ROLLBACK,
// so it catches constraint violations); pass --apply to COMMIT. Excludes events (append-only), the monitoring
// audit log, and per-company config (canonical has its own). company_id guards bypassed (runs as postgres).
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
if (existsSync(".env.local")) for (const line of readFileSync(".env.local","utf8").split(/\r?\n/)) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m)continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); if(!(m[1] in process.env))process.env[m[1]]=v; }
const CANONICAL = "28203036-6b05-488a-b62d-714033e87cd5";
const SOURCES = ["29c63a47-b2b8-4e08-8e02-c416ea8da86e","fbeff8a9-86c9-4929-9842-067c0d673292","28bb4d90-639f-44c8-9746-f68041252c7d","2dd1a07d-572f-4185-97d0-0583c8fe3bf0"];
const MOVE = ["coaching_sessions","after_pitch_summaries","kpi_snapshot","door_knocks","pitches","pitch_transcripts","pitch_analyses","coaching_cues","coaching_retranscribe_cache","files","profiles"];
const APPLY = process.argv.includes("--apply");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:20000 });
await c.connect();
const srcArr = `ARRAY[${SOURCES.map(s=>`'${s}'::uuid`).join(",")}]`;
await c.query("BEGIN");
try {
  console.log(`\n=== MERGE ${APPLY?"APPLY":"DRY-RUN"} → canonical ${CANONICAL} ===`);
  const before = (await c.query(`select count(*) n from coaching_sessions where company_id=$1`,[CANONICAL])).rows[0].n;
  console.log(`canonical coaching_sessions BEFORE: ${before}`);
  let movedTotal = 0;
  for (const t of MOVE) {
    const r = await c.query(`update "${t}" set company_id=$1 where company_id = any(${srcArr})`,[CANONICAL]);
    console.log(`  ${t}: moved ${r.rowCount}`);
    if (t==="coaching_sessions") movedTotal = r.rowCount;
  }
  const scope = await c.query(`delete from vendor_monitoring_scope where company_id = any(${srcArr})`);
  console.log(`  vendor_monitoring_scope: removed ${scope.rowCount} duplicate entries`);
  const ren = await c.query(`update companies set name = name || ' [merged '||left(id::text,8)||']' where id = any(${srcArr})`);
  console.log(`  companies renamed: ${ren.rowCount}`);
  const after = (await c.query(`select count(*) n from coaching_sessions where company_id=$1`,[CANONICAL])).rows[0].n;
  const agents = (await c.query(`select count(*) n from profiles where company_id=$1`,[CANONICAL])).rows[0].n;
  console.log(`canonical coaching_sessions AFTER: ${after}  |  canonical agents AFTER: ${agents}`);
  if (APPLY) { await c.query("COMMIT"); console.log("\n✅ COMMITTED."); }
  else { await c.query("ROLLBACK"); console.log("\n↩️  DRY-RUN — rolled back, nothing written. Re-run with --apply to commit."); }
} catch (e) { await c.query("ROLLBACK"); console.error("\n✗ ROLLED BACK on error:", e.message); process.exitCode=1; }
await c.end();
