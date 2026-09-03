import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const { data: aps } = await sb.from("after_pitch_summaries").select("payload").limit(3);
console.log(`after_pitch_summaries sampled: ${aps?.length ?? 0}`);
for(const a of aps ?? []){
  const p = a.payload || {};
  console.log("\n  payload keys:", Object.keys(p).join(", "));
  if(p.scores) console.log("  SCORES keys/shape:", JSON.stringify(p.scores).slice(0,400));
  if(p.moments) console.log("  moments: array of", Array.isArray(p.moments)?p.moments.length:"?", "(sample keys:", Array.isArray(p.moments)&&p.moments[0]?Object.keys(p.moments[0]).join(","):"—", ")");
}
// KPI layer-3 dimension keys the existing system scores (from event kinds / any stored)
const { data: evK } = await sb.from("events").select("kind").ilike("kind","coach.%").limit(1000);
const kinds = {}; for(const e of evK ?? []) kinds[e.kind]=(kinds[e.kind]??0)+1;
console.log("\ncoach.* event kinds (existing pipeline surfaces):", JSON.stringify(kinds));
process.exit(0);
