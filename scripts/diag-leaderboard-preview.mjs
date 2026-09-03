import { readFileSync } from "node:fs"; import pg from "pg";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c=new pg.Client({connectionString:env.SUPABASE_DB_URL}); await c.connect();
// pick the company with the most ledger rows
const { rows: comp } = await c.query(`select company_id, count(*) n from agent_point_ledger group by 1 order by 2 desc limit 1`);
const cid = comp[0].company_id;
console.log(`leaderboard for company ${cid.slice(0,8)} (${comp[0].n} ledger rows):\n`);
const { rows } = await c.query(`
  with pts as (
    select l.agent_id, count(*) filter (where l.reason='session_score') sessions, sum(l.points) total_points,
           round(avg(l.points) filter (where l.reason='session_score'),1) avg_points, max(l.points) filter (where l.reason='session_score') best
    from agent_point_ledger l where l.company_id=$1 group by l.agent_id),
  d as (select agent_id, count(*)::int deals from coaching_sessions where company_id=$1 and outcome='sold' group by 1)
  select coalesce(pr.full_name,left(p.agent_id::text,8)) agent, p.sessions, p.total_points, p.avg_points, p.best, coalesce(d.deals,0) deals
  from pts p left join d on d.agent_id=p.agent_id left join profiles pr on pr.id=p.agent_id
  order by p.total_points desc, p.avg_points desc, p.sessions asc`, [cid]);
console.log("RANK  AGENT              SESS  TOTAL  AVG   BEST  DEALS");
rows.forEach((r,i)=>console.log(`${String(i+1).padStart(2)}    ${String(r.agent).slice(0,16).padEnd(18)} ${String(r.sessions).padStart(3)}  ${String(r.total_points).padStart(5)}  ${String(r.avg_points).padStart(4)}  ${String(r.best).padStart(3)}   ${r.deals}`));
await c.end(); process.exit(0);
