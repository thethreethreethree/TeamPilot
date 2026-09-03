// Phase-1 definition-of-done proof for agent_point_ledger. Runs inside ONE transaction and ROLLS BACK, so no test
// rows persist (the append-only trigger blocks DELETE for everyone, so we must never COMMIT a test row). Proves:
//   1. an insert succeeds, 2. UPDATE raises 'append-only', 3. DELETE raises 'append-only', 4. a second
//   session_score for the same session fails (no double-bank). NO writes survive.
import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const conn = env.SUPABASE_DB_URL;
if(!conn){ console.error("SUPABASE_DB_URL not set"); process.exit(1); }
const client = new pg.Client({ connectionString: conn });
await client.connect();

// Real ids for the FKs (rolled back, so nothing persists).
const { rows: crow } = await client.query("select id from companies limit 1");
const { rows: prow } = await client.query("select id from profiles limit 1");
const { rows: srow } = await client.query("select id from coaching_sessions limit 1");
const company = crow[0].id, agent = prow[0].id, session = srow[0].id;

let pass = 0, fail = 0;
const ok = (name, cond, detail="") => { console.log(`${cond?"  ✓":"  ✗"} ${name}${detail?" — "+detail:""}`); cond?pass++:fail++; };
async function expectRaise(name, sql, params, match) {
  await client.query("SAVEPOINT sp");
  try { await client.query(sql, params); ok(name, false, "expected an error, none thrown"); await client.query("ROLLBACK TO SAVEPOINT sp"); }
  catch(e){ await client.query("ROLLBACK TO SAVEPOINT sp"); ok(name, e.message.includes(match), e.message.split("\n")[0]); }
}

await client.query("BEGIN");
try {
  // 1. insert succeeds
  const ins = await client.query(
    `insert into agent_point_ledger (company_id, agent_id, session_id, points, reason, detail)
     values ($1,$2,$3,72,'session_score','{"band":"solid"}') returning id`, [company, agent, session]);
  const id = ins.rows[0].id; ok("insert a session_score row", !!id, `id ${id.slice(0,8)}`);

  // 2. UPDATE raises append-only
  await expectRaise("UPDATE is blocked (append-only)", `update agent_point_ledger set points=99 where id=$1`, [id], "append-only");
  // 3. DELETE raises append-only
  await expectRaise("DELETE is blocked (append-only)", `delete from agent_point_ledger where id=$1`, [id], "append-only");
  // 4. second session_score for the same session → unique violation (no double-bank)
  await expectRaise("double-bank blocked (unique session_score per session)",
    `insert into agent_point_ledger (company_id, agent_id, session_id, points, reason) values ($1,$2,$3,50,'session_score')`,
    [company, agent, session], "duplicate key");
  // 5. a 'correction' row for the SAME session IS allowed (only session_score is unique)
  await client.query("SAVEPOINT sp2");
  try { await client.query(`insert into agent_point_ledger (company_id, agent_id, session_id, points, reason) values ($1,$2,$3,-10,'correction')`, [company, agent, session]); ok("a correction row for the same session is allowed", true); await client.query("ROLLBACK TO SAVEPOINT sp2"); }
  catch(e){ ok("a correction row for the same session is allowed", false, e.message.split("\n")[0]); await client.query("ROLLBACK TO SAVEPOINT sp2"); }
} finally {
  await client.query("ROLLBACK"); // nothing persists
  await client.end();
}
console.log(`\n${fail===0?"✅":"❌"} ${pass} passed, ${fail} failed (transaction rolled back — no rows persisted)`);
process.exit(fail===0?0:1);
