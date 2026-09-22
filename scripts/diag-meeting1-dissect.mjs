// READ-ONLY: why did the non-reasoning dissect parse-fail for "Meeting 1"? Transcribe + call deepseek-chat + log
// finish_reason + answer length + head/tail so we see truncation vs malformed vs error. No writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const sid="76f8ae8b-970f-4d95-abd8-8c408a6b527f", company="28203036-6b05-488a-b62d-714033e87cd5";
const { data: s } = await sb.from("coaching_sessions").select("audio_asset_url").eq("id",sid).maybeSingle();
const { data: dl } = await sb.storage.from("assets-v1").download(s.audio_asset_url.replace(/^assets-v1\//,""));
const form=new FormData(); form.append("file", new Blob([Buffer.from(await dl.arrayBuffer())],{type:"audio/webm"}),"r.webm");
form.append("model_id","scribe_v1"); form.append("diarize","true");
const stt=await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":env.ELEVENLABS_API_KEY},body:form});
const words=(await stt.json()).words ?? []; const turns=[]; let cur=null;
for(const w of words){ const sp=w.speaker_id??"UNKNOWN"; if(!cur||cur.spk!==sp){cur={spk:sp,text:w.text??""};turns.push(cur);} else cur.text+=w.text??""; }
const transcript=turns.map(t=>`${t.spk}: ${t.text.replace(/\s+/g," ").trim()}`).join("\n");
console.log(`transcript ${transcript.length} chars (~${Math.round(transcript.length/4)} tokens), ${turns.length} turns`);
const systemPrompt=`You review a team meeting and output ONLY JSON: {"decisions":[{"decision":"...","context":"..."}],"actions":[{"action":"...","owner":"name or null"}],"openItems":[{"item":"...","why":"..."}],"effectiveness":{"focused":true,"note":"..."},"overall":"..."} No prose outside the JSON.`;
const res=await fetch("https://api.deepseek.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"deepseek-chat",messages:[{role:"system",content:systemPrompt},{role:"user",content:`Transcript (diarized):\n\n${transcript}\n\nJSON only.`}],max_tokens:8000,response_format:{type:"json_object"}})});
const j=await res.json(); const c=j.choices?.[0];
const content=c?.message?.content??"";
console.log(`finish_reason=${c?.finish_reason} usage=${JSON.stringify(j.usage)}`);
console.log(`answer length=${content.length}`);
console.log(`HEAD: ${content.slice(0,150)}`);
console.log(`TAIL: ${content.slice(-150)}`);
let ok=false; try{ JSON.parse(content); ok=true; }catch(e){ console.log(`JSON.parse error: ${e.message}`); }
console.log(`parses=${ok}`);
process.exit(0);
