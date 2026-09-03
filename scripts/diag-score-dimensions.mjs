import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const { data: aps } = await sb.from("after_pitch_summaries").select("payload").limit(60);
const dims = {}; let scored=0, withCitation=0, totalScores=0;
for(const a of aps ?? []){
  const s = a.payload?.scores;
  if(Array.isArray(s) && s.length){ scored++;
    for(const d of s){ const k=d.key||d.label; dims[k]=(dims[k]??0)+1; totalScores++; if(d.citation) withCitation++; }
  }
}
console.log(`after_pitch_summaries sampled: ${aps?.length}, with a scores[] array: ${scored}`);
console.log(`distinct dimension keys seen:`);
for(const [k,n] of Object.entries(dims).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${n}`);
console.log(`\nof ${totalScores} dimension-scores, ${withCitation} carry a verbatim citation (${Math.round(withCitation/totalScores*100)}%)`);
process.exit(0);
