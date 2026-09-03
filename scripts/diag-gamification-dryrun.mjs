// READ-ONLY dry-run: what points would the EXISTING scored sessions bank? Mirrors computeSessionPoints (mean of
// counted dims × 10 → 0-100 + band) over after_pitch_summaries.payload.scores. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const COUNTED = new Set(["opener","objection","tone","close","next_step","talk_ratio","question_rate"]);
const bandFor = p => p>=90?"elite":p>=80?"strong":p>=60?"solid":p>=40?"developing":"needs_coaching";
const { data: aps } = await sb.from("after_pitch_summaries").select("payload").limit(500);
const points=[], bands={elite:0,strong:0,solid:0,developing:0,needs_coaching:0}; let nullCount=0;
for(const a of aps ?? []){
  const scores = a.payload?.scores; if(!Array.isArray(scores)){ continue; }
  const counted = scores.filter(c=>COUNTED.has(c.key) && typeof c.score==="number" && Number.isFinite(c.score));
  if(counted.length===0){ nullCount++; continue; }
  const pts = Math.round(counted.reduce((s,c)=>s+c.score,0)/counted.length*10);
  points.push(pts); bands[bandFor(pts)]++;
}
points.sort((a,b)=>a-b);
const pc = p => points.length?points[Math.floor((points.length-1)*p)]:0;
console.log(`scored sessions with bankable points: ${points.length} (${nullCount} not-scoreable → bank nothing)`);
console.log(`points: min=${points[0]} p25=${pc(0.25)} median=${pc(0.5)} p75=${pc(0.75)} max=${points[points.length-1]}  mean=${Math.round(points.reduce((a,b)=>a+b,0)/points.length)}`);
console.log(`band distribution:`);
for(const [b,n] of Object.entries(bands)) console.log(`  ${b.padEnd(15)} ${n}  ${"█".repeat(Math.round(n/points.length*40))} ${Math.round(n/points.length*100)}%`);
const strongPct = Math.round(bands.strong/points.length*100)+Math.round(bands.elite/points.length*100);
console.log(`\nManager 'strong session' alert (≥80) would fire on ${bands.strong+bands.elite}/${points.length} sessions (~${strongPct}%).`);
process.exit(0);
