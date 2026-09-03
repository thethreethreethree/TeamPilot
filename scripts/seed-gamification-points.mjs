// ONE-TIME seed (Phase 3 backfill): bank points for every already-scored session with no ledger row yet. Mirrors
// bankSessionPoints (reuse decision — points from the existing after-pitch scores). Idempotent: skips sessions that
// already have a session_score row and catches the unique violation. Pass --apply to write (dry-run by default).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const COUNTED = new Set(["opener","objection","tone","close","next_step","talk_ratio","question_rate"]);
const RUBRIC_VERSION="v1";
const bandFor = p => p>=90?"elite":p>=80?"strong":p>=60?"solid":p>=40?"developing":"needs_coaching";

const { data: aps } = await sb.from("after_pitch_summaries").select("session_id, company_id, agent_id, payload").limit(2000);
// dedupe to latest per session
const bySession = new Map();
for(const a of aps ?? []) if(!bySession.has(a.session_id)) bySession.set(a.session_id, a);
const sessionIds = [...bySession.keys()];
// existing session_score rows
const already = new Set();
for(let i=0;i<sessionIds.length;i+=200){ const { data: led } = await sb.from("agent_point_ledger").select("session_id").eq("reason","session_score").in("session_id", sessionIds.slice(i,i+200)); for(const r of led??[]) already.add(r.session_id); }

let banked=0, skipped=0, notScoreable=0;
for(const [sid, a] of bySession){
  if(already.has(sid)){ skipped++; continue; }
  const scores = a.payload?.scores;
  const counted = Array.isArray(scores) ? scores.filter(c=>COUNTED.has(c.key)&&typeof c.score==="number"&&Number.isFinite(c.score)) : [];
  if(counted.length===0){ notScoreable++; continue; }
  const points = Math.round(counted.reduce((s,c)=>s+c.score,0)/counted.length*10);
  const dimensions = Object.fromEntries(counted.map(c=>[c.key,c.score]));
  if(!APPLY){ banked++; continue; }
  const { error } = await sb.from("agent_point_ledger").insert({ company_id:a.company_id, agent_id:a.agent_id, session_id:sid, points, reason:"session_score", detail:{ rubric_version:RUBRIC_VERSION, band:bandFor(points), dimensions } });
  if(error){ if(error.code==="23505"){ skipped++; } else { console.log(`  ✗ ${sid.slice(0,8)}: ${error.message}`); } continue; }
  banked++;
}
console.log(`${APPLY?"APPLIED":"DRY-RUN"}: scanned ${sessionIds.length} scored sessions → ${banked} banked, ${skipped} already-had-a-row, ${notScoreable} not-scoreable (banked nothing)`);
process.exit(0);
