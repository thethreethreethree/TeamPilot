// READ-ONLY (Phase-0 H25): the real distribution of sales-session durations + transcript lengths + agent-turn
// counts, so the gamification eligibility thresholds (RUBRIC-SPEC 5: 6 agent turns / 60s / prospect turn >3 words)
// are set from reality, not guesses. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

// Sales sessions only (exclude meeting/huddle).
const { data: rows } = await sb.from("coaching_sessions")
  .select("id, context, session_kind, status, audio_duration_seconds, started_at, ended_at")
  .or("session_kind.is.null,session_kind.eq.sales").limit(2000);
const sales = (rows ?? []);
console.log(`sales sessions (session_kind sales/null): ${sales.length}`);

// context distribution (channel: in_person vs video → door_to_door/voice/video mapping)
const byCtx = {}; for (const s of sales) byCtx[s.context ?? "null"] = (byCtx[s.context ?? "null"] ?? 0) + 1;
console.log("context:", JSON.stringify(byCtx));

// audio_duration_seconds buckets
const durs = sales.map(s=>s.audio_duration_seconds).filter(d=>d!=null && d>0);
const buckets = {"<30s":0,"30-60s":0,"60-180s":0,"180-600s":0,">600s":0};
for(const d of durs){ if(d<30)buckets["<30s"]++; else if(d<60)buckets["30-60s"]++; else if(d<180)buckets["60-180s"]++; else if(d<600)buckets["180-600s"]++; else buckets[">600s"]++; }
durs.sort((a,b)=>a-b);
const pct = p => durs.length ? durs[Math.floor((durs.length-1)*p)] : 0;
console.log(`\naudio_duration_seconds (n=${durs.length} with real audio length):`);
console.log("  buckets:", JSON.stringify(buckets));
console.log(`  p10=${pct(0.1)}s p25=${pct(0.25)}s p50=${pct(0.5)}s p75=${pct(0.75)}s p90=${pct(0.9)}s`);

// transcript segment + agent-turn distribution (sample the most recent 120 sessions to bound cost)
const sample = sales.slice(0, 120);
const segCounts=[], agentTurns=[];
for(const s of sample){
  const { data: segs } = await sb.from("coaching_transcript_segments").select("speaker").eq("session_id", s.id);
  const n = segs?.length ?? 0; segCounts.push(n);
  agentTurns.push((segs ?? []).filter(x=>x.speaker==="agent").length);
}
const withSeg = segCounts.filter(n=>n>0).length;
segCounts.sort((a,b)=>a-b); agentTurns.sort((a,b)=>a-b);
const pc = (arr,p)=>arr.length?arr[Math.floor((arr.length-1)*p)]:0;
console.log(`\ntranscript segments per session (sampled ${sample.length}; ${withSeg} have >0 segments):`);
console.log(`  segments p25=${pc(segCounts,0.25)} p50=${pc(segCounts,0.5)} p75=${pc(segCounts,0.75)} p90=${pc(segCounts,0.9)} max=${segCounts[segCounts.length-1]}`);
console.log(`  AGENT turns p25=${pc(agentTurns,0.25)} p50=${pc(agentTurns,0.5)} p75=${pc(agentTurns,0.75)} p90=${pc(agentTurns,0.9)}`);
const below6 = agentTurns.filter(n=>n<6).length;
console.log(`  sessions with <6 agent turns (RUBRIC-SPEC 5 gate): ${below6}/${sample.length} (${Math.round(below6/sample.length*100)}%) would be 'not_scoreable' on that threshold`);
console.log(`\nNOTE: many sales sessions store durable AUDIO re-transcribed on demand (not persisted segments) — segment counts undercount those; the after-pitch/dissect path transcribes them. See FINDINGS C13-14.`);
process.exit(0);
