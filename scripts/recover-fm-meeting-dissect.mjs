// RECOVERY: generate + store the meeting DISSECT for the founder's recovered meeting so the review shows content
// NOW (independent of the code deploy). Mirrors generateAndStoreMeetingDissect: transcribe the recovered audio →
// NON-REASONING model (deepseek-chat, the deployed fix) → the exact parseMeetingDissect normalization → insert the
// append-only meeting.dissect_generated event. Idempotent (skips if one already exists). One session by id.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const sid="d5ed4699-f766-47e4-af7f-2161e5b087a7", company="c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
const CACHE="C:/Users/johns/AppData/Local/Temp/claude/c--Users-johns-OneDrive-Documents-GitHub-TeamPilot/000f2306-81f6-4d09-bc5c-972ec664d03e/scratchpad/fm-transcript.txt";

const { data: sess } = await sb.from("coaching_sessions").select("agent_id, client_label").eq("id",sid).maybeSingle();
const actor = sess.agent_id;
const { data: existing } = await sb.from("events").select("id").eq("subject",`meeting_session:${sid}`).eq("kind","meeting.dissect_generated").limit(1);
if(existing?.length){ console.log("dissect_generated already exists — skipping"); process.exit(0); }

// Transcript (cached from the earlier verify run).
let transcript;
if(existsSync(CACHE)){ transcript=readFileSync(CACHE,"utf8"); }
else {
  const { data } = await sb.storage.from("assets-v1").download(`${company}/${sid}/recording.webm`);
  const form=new FormData(); form.append("file", new Blob([Buffer.from(await data.arrayBuffer())],{type:"audio/webm"}),"recording.webm");
  form.append("model_id","scribe_v1"); form.append("diarize","true");
  const stt=await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":env.ELEVENLABS_API_KEY},body:form});
  const j=await stt.json(); const words=j.words??[]; const turns=[]; let cur=null;
  for(const w of words){ const s=w.speaker_id??"UNKNOWN"; if(!cur||cur.spk!==s){cur={spk:s,text:w.text??""};turns.push(cur);} else cur.text+=w.text??""; }
  transcript=turns.map(t=>`${t.spk}: ${t.text.replace(/\s+/g," ").trim()}`).join("\n"); writeFileSync(CACHE,transcript);
}

// EXACT system prompt from meetingDissectPrompt.ts (the OUTPUT contract is what matters for the parse).
const systemPrompt=`You review a team meeting AFTER it ends and produce an honest, structured read of what the meeting actually PRODUCED. You are NOT scoring anyone and NOT a sales reviewer. WHAT TO EXTRACT (only what the transcript supports — never invent): DECISIONS (concrete decisions actually reached); ACTIONS (next-steps agreed, each with its OWNER if named, else owner null); OPEN ITEMS (raised but left unresolved); EFFECTIVENESS (focused vs drifted, evidence-based). HONESTY: base every item on the transcript; empty arrays are valid. OUTPUT — respond with ONLY this JSON: {"decisions":[{"decision":"...","context":"..."}],"actions":[{"action":"...","owner":"name or null"}],"openItems":[{"item":"...","why":"left unresolved because ..."}],"effectiveness":{"focused":true,"note":"..."},"overall":"one or two sentences: what this meeting produced, honestly"} Use null for a missing owner. No prose outside the JSON.`;
const userMessage=`Meeting: ${sess.client_label ?? ""}\n\nTranscript (diarized, one line per speaker turn):\n\n${transcript}\n\nExtract the decisions, owned actions, open items, and an effectiveness read. JSON only.`;

const res=await fetch("https://api.deepseek.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"deepseek-chat",messages:[{role:"system",content:systemPrompt},{role:"user",content:userMessage}],max_tokens:8000,response_format:{type:"json_object"}})});
const j=await res.json(); const content=j.choices?.[0]?.message?.content??"";
let raw; try{ const m=content.match(/\{[\s\S]*\}/); raw=JSON.parse(m?m[0]:content);}catch{ console.error("parse failed:",content.slice(0,200)); process.exit(1); }

// parseMeetingDissect normalization (verbatim logic).
const str=v=>typeof v==="string"?v.trim():""; const A=v=>Array.isArray(v)?v:[];
const NO_OWNER=/^(null|none|no one|nobody|unassigned|unowned|someone|the team|everyone|n\/a|tbd|-)$/i;
const decisions=A(raw.decisions).map(d=>({decision:str(d?.decision),context:str(d?.context)})).filter(d=>d.decision);
const actions=A(raw.actions).map(a=>{const o=str(a?.owner);return{action:str(a?.action),owner:o&&!NO_OWNER.test(o)?o:null};}).filter(a=>a.action);
const openItems=A(raw.openItems).map(i=>({item:str(i?.item),why:str(i?.why)})).filter(i=>i.item);
let eff=null; if(raw.effectiveness&&typeof raw.effectiveness==="object"){const e=raw.effectiveness;const note=str(e.note);if(note||typeof e.focused==="boolean")eff={focused:e.focused===true,note};}
const overall=str(raw.overall);
const hasSignal=decisions.length||actions.length||openItems.length||eff;
if(!hasSignal){ console.error("no signal — not storing"); process.exit(1); }

const { error }=await sb.from("events").insert({ company_id:company, actor, kind:"meeting.dissect_generated", subject:`meeting_session:${sid}`,
  payload:{ decisions, actions, open_items:openItems, effectiveness:eff, balance:null, agenda:null, overall:overall||null, coach_version:"meeting-dissect-v1" } });
if(error){ console.error("insert failed:",error.message); process.exit(1); }
console.log(`✅ stored dissect for "${sess.client_label}": ${decisions.length} decisions, ${actions.length} actions, ${openItems.length} open items`);
console.log(`   overall: ${overall}`);
console.log(`   actions:`); actions.forEach(a=>console.log(`     - ${a.action}${a.owner?` (owner: ${a.owner})`:" (no owner)"}`));
process.exit(0);
