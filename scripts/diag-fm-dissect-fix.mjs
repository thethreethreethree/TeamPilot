// READ-ONLY: test fixes for the long-meeting dissect reasoning-starvation. Transcribes once (caches to scratchpad),
// then tries: (A) non-reasoning model deepseek-chat on the FULL transcript, (B) deepseek-v4-flash on the first
// THIRD (chunking hypothesis). Reports finish_reason + answer for each so we pick the fix that actually works.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const company = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7", sid = "d5ed4699-f766-47e4-af7f-2161e5b087a7";
const CACHE = "C:/Users/johns/AppData/Local/Temp/claude/c--Users-johns-OneDrive-Documents-GitHub-TeamPilot/000f2306-81f6-4d09-bc5c-972ec664d03e/scratchpad/fm-transcript.txt";

let transcript;
if (existsSync(CACHE)) { transcript = readFileSync(CACHE, "utf8"); console.log("using cached transcript"); }
else {
  const { data } = await sb.storage.from("assets-v1").download(`${company}/${sid}/recording.webm`);
  const bytes = Buffer.from(await data.arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/webm" }), "recording.webm");
  form.append("model_id", "scribe_v1"); form.append("diarize", "true");
  console.log("transcribing…");
  const stt = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, body: form });
  const sttJson = await stt.json();
  const words = sttJson.words ?? []; const turns = []; let cur = null;
  for (const w of words) { const spk = w.speaker_id ?? "UNKNOWN"; if (!cur || cur.spk !== spk) { cur = { spk, text: w.text ?? "" }; turns.push(cur); } else cur.text += w.text ?? ""; }
  transcript = turns.map((t) => `${t.spk}: ${t.text.replace(/\s+/g, " ").trim()}`).join("\n");
  writeFileSync(CACHE, transcript); console.log("cached transcript");
}
console.log(`transcript ${transcript.length} chars (~${Math.round(transcript.length/4)} tokens)`);

const systemPrompt = `You review a team meeting AFTER it ends and produce an honest, structured read of what the meeting actually PRODUCED. Extract DECISIONS, ACTIONS (with owner or null), OPEN ITEMS, EFFECTIVENESS. OUTPUT — respond with ONLY this JSON: {"decisions":[{"decision":"...","context":"..."}],"actions":[{"action":"...","owner":"name or null"}],"openItems":[{"item":"...","why":"..."}],"effectiveness":{"focused":true,"note":"..."},"overall":"..."} No prose outside the JSON.`;
const mkUser = (t) => `Meeting: 9/2 JOHN RAMOS.\n\nTranscript (diarized):\n\n${t}\n\nExtract decisions, owned actions, open items, effectiveness. JSON only.`;

async function tryCall(label, model, t, maxTokens) {
  const t0 = Date.now();
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: mkUser(t) }], max_tokens: maxTokens, response_format: { type: "json_object" } }),
  });
  const ms = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) { console.log(`\n[${label}] HTTP ${res.status} in ${ms}s: ${(await res.text()).slice(0,200)}`); return; }
  const j = await res.json(); const c = j.choices?.[0]; const content = c?.message?.content ?? "";
  let ok = false, counts = ""; try { const p = JSON.parse(content); ok = true; counts = `decisions=${p.decisions?.length ?? "?"} actions=${p.actions?.length ?? "?"} openItems=${p.openItems?.length ?? "?"}`; } catch {}
  console.log(`\n[${label}] model=${model} ${ms}s finish=${c?.finish_reason} reasoning_tokens=${j.usage?.completion_tokens_details?.reasoning_tokens ?? 0} answer=${content.length}chars parses=${ok} ${counts}`);
  if (ok) console.log(`   overall: ${(JSON.parse(content).overall || "").slice(0,200)}`);
}

// (A) non-reasoning model, full transcript
await tryCall("A: deepseek-chat FULL", "deepseek-chat", transcript, 2000);
// (B) reasoning model, first third (chunking hypothesis)
const lines = transcript.split("\n"); const third = lines.slice(0, Math.ceil(lines.length/3)).join("\n");
await tryCall("B: v4-flash FIRST-THIRD", "deepseek-v4-flash", third, 8000);
process.exit(0);
