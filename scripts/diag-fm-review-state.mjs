import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const sid="d5ed4699-f766-47e4-af7f-2161e5b087a7", company="c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
const { data: s } = await sb.from("coaching_sessions").select("audio_asset_url, session_kind, status, company_id").eq("id",sid).maybeSingle();
console.log("session:", JSON.stringify(s));
// Does the stamped recording actually exist + size?
const path = s?.audio_asset_url?.replace(/^assets-v1\//,"");
if(path){ const { data: files } = await sb.storage.from("assets-v1").list(path.split("/").slice(0,-1).join("/")); const f=(files||[]).find(x=>x.name==="recording.webm"); console.log("recording.webm in storage:", f?`${f.metadata?.size} bytes`:"MISSING"); }
// meeting_session events (dissect cache markers)
const { data: evs } = await sb.from("events").select("kind, created_at, payload").eq("subject",`meeting_session:${sid}`).order("created_at");
console.log("\nmeeting_session events:", (evs||[]).map(e=>`${e.kind}@${e.created_at?.slice(11,19)}`));
for(const e of evs||[]){ if(e.kind==="meeting.dissect_attempted") console.log("  ⚠ ATTEMPTED marker present → route returns cached-empty without ?force=1"); if(e.kind==="meeting.dissect_generated") console.log("  ✓ dissect_generated payload keys:", Object.keys(e.payload||{})); }
process.exit(0);
