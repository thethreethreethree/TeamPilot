// Recover the REVIEW for every recovered meeting that has audio but no generated dissect yet — the same operation
// the deployed fix does on first view, run proactively so no owner hits an empty review before the deploy. Uses the
// NON-REASONING model (the fix). Mirrors generateAndStoreMeetingDissect. Dry-run by default; --apply to write.
//   node scripts/backfill-orphaned-meeting-dissects.mjs [--apply]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

const { data: sessions } = await sb.from("coaching_sessions")
  .select("id, company_id, agent_id, client_label, audio_asset_url")
  .in("session_kind",["meeting","huddle"]).not("audio_asset_url","is",null)
  .order("started_at",{ascending:false}).limit(200);

const str=v=>typeof v==="string"?v.trim():""; const A=v=>Array.isArray(v)?v:[];
const NO_OWNER=/^(null|none|no one|nobody|unassigned|unowned|someone|the team|everyone|n\/a|tbd|-)$/i;
const systemPrompt=`You review a team meeting AFTER it ends and produce an honest, structured read of what the meeting actually PRODUCED. Extract DECISIONS (concrete decisions actually reached), ACTIONS (each with its OWNER if named, else owner null), OPEN ITEMS (raised but left unresolved), EFFECTIVENESS (focused vs drifted, evidence-based). Base every item on the transcript; empty arrays are valid. OUTPUT — respond with ONLY this JSON: {"decisions":[{"decision":"...","context":"..."}],"actions":[{"action":"...","owner":"name or null"}],"openItems":[{"item":"...","why":"..."}],"effectiveness":{"focused":true,"note":"..."},"overall":"..."} Use null for a missing owner. No prose outside the JSON.`;

let done=0;
for (const s of sessions ?? []) {
  const { data: ex } = await sb.from("events").select("id").eq("subject",`meeting_session:${s.id}`).in("kind",["meeting.dissect_generated","meeting.dissect_attempted"]).limit(1);
  if (ex?.length) continue; // already has a review (or a genuine-empty backoff) — skip
  const label = `"${s.client_label ?? "?"}" ${s.id.slice(0,8)}`;
  if (!APPLY) { console.log(`[dry] would generate review for meeting ${label}`); continue; }

  const path = s.audio_asset_url.replace(/^assets-v1\//,"");
  const { data: dl } = await sb.storage.from("assets-v1").download(path);
  if (!dl) { console.log(`  ✗ ${label}: audio download failed`); continue; }
  const form=new FormData(); form.append("file", new Blob([Buffer.from(await dl.arrayBuffer())],{type:"audio/webm"}),"recording.webm");
  form.append("model_id","scribe_v1"); form.append("diarize","true");
  const stt=await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":env.ELEVENLABS_API_KEY},body:form});
  if(!stt.ok){ console.log(`  ✗ ${label}: STT ${stt.status}`); continue; }
  const words=(await stt.json()).words ?? []; const turns=[]; let cur=null;
  for(const w of words){ const sp=w.speaker_id??"UNKNOWN"; if(!cur||cur.spk!==sp){cur={spk:sp,text:w.text??""};turns.push(cur);} else cur.text+=w.text??""; }
  const transcript=turns.map(t=>`${t.spk}: ${t.text.replace(/\s+/g," ").trim()}`).join("\n");
  if(!transcript.trim()){ console.log(`  · ${label}: silent audio, skipped`); continue; }

  const res=await fetch("https://api.deepseek.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"deepseek-chat",messages:[{role:"system",content:systemPrompt},{role:"user",content:`Transcript (diarized):\n\n${transcript}\n\nJSON only.`}],max_tokens:8000,response_format:{type:"json_object"}})});
  let raw; try{ const c=(await res.json()).choices?.[0]?.message?.content??""; const m=c.match(/\{[\s\S]*\}/); raw=JSON.parse(m?m[0]:c);}catch{ console.log(`  ✗ ${label}: parse failed`); continue; }
  const decisions=A(raw.decisions).map(d=>({decision:str(d?.decision),context:str(d?.context)})).filter(d=>d.decision);
  const actions=A(raw.actions).map(a=>{const o=str(a?.owner);return{action:str(a?.action),owner:o&&!NO_OWNER.test(o)?o:null};}).filter(a=>a.action);
  const openItems=A(raw.openItems).map(i=>({item:str(i?.item),why:str(i?.why)})).filter(i=>i.item);
  let eff=null; if(raw.effectiveness&&typeof raw.effectiveness==="object"){const e=raw.effectiveness;const n=str(e.note);if(n||typeof e.focused==="boolean")eff={focused:e.focused===true,note:n};}
  if(!(decisions.length||actions.length||openItems.length||eff)){ console.log(`  · ${label}: no signal (genuine thin meeting), skipped`); continue; }
  const { error }=await sb.from("events").insert({ company_id:s.company_id, actor:s.agent_id, kind:"meeting.dissect_generated", subject:`meeting_session:${s.id}`,
    payload:{ decisions, actions, open_items:openItems, effectiveness:eff, balance:null, agenda:null, overall:str(raw.overall)||null, coach_version:"meeting-dissect-v1" } });
  if(error){ console.log(`  ✗ ${label}: insert ${error.message}`); continue; }
  console.log(`  ✓ ${label}: ${decisions.length} decisions, ${actions.length} actions, ${openItems.length} open items`);
  done++;
}
console.log(`\n${APPLY?"APPLIED":"DRY-RUN"}: recovered reviews for ${done} meeting(s).`);
process.exit(0);
