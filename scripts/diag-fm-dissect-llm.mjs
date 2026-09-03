// READ-ONLY reproduction of the meeting-dissect LLM call on the founder's real transcript, to see WHY it returns
// "transient" (empty/truncated/timeout). Transcribes the recovered audio, builds the real prompt, calls DeepSeek
// exactly as the provider does (deepseek-v4-flash, max_tokens=min(1100+7000,8000)=8000, json_object), and reports
// finish_reason + reasoning vs answer token split + timing. No writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const company = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7", sid = "d5ed4699-f766-47e4-af7f-2161e5b087a7";

// 1. Transcribe the recovered recording (diarized), same as the route.
const { data } = await sb.storage.from("assets-v1").download(`${company}/${sid}/recording.webm`);
const bytes = Buffer.from(await data.arrayBuffer());
const form = new FormData();
form.append("file", new Blob([bytes], { type: "audio/webm" }), "recording.webm");
form.append("model_id", "scribe_v1"); form.append("diarize", "true");
console.log("transcribing…");
const stt = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, body: form });
const sttJson = await stt.json();
// Build diarized turns SPEAKER: text (approximating renderTurns) by grouping words by speaker.
const words = sttJson.words ?? [];
const turns = []; let cur = null;
for (const w of words) {
  const spk = w.speaker_id ?? "UNKNOWN";
  if (!cur || cur.spk !== spk) { cur = { spk, text: (w.text ?? "") }; turns.push(cur); }
  else cur.text += w.text ?? "";
}
const transcript = turns.map((t) => `${t.spk}: ${t.text.replace(/\s+/g, " ").trim()}`).join("\n");
console.log(`transcript: ${transcript.length} chars, ${turns.length} turns, ~${Math.round(transcript.length/4)} tokens`);

// 2. The real system + user prompt (from meetingDissectPrompt.ts).
const systemPrompt = `You review a team meeting AFTER it ends and produce an honest, structured read of what the meeting actually PRODUCED. Extract DECISIONS, ACTIONS (with owner or null), OPEN ITEMS, EFFECTIVENESS. HONESTY: base every item on the transcript. OUTPUT — respond with ONLY this JSON: {"decisions":[{"decision":"...","context":"..."}],"actions":[{"action":"...","owner":"name or null"}],"openItems":[{"item":"...","why":"..."}],"effectiveness":{"focused":true,"note":"..."},"overall":"..."} No prose outside the JSON.`;
const userMessage = `Meeting: 9/2 JOHN RAMOS.\n\nTranscript (diarized, one line per speaker turn):\n\n${transcript}\n\nExtract the decisions, owned actions, open items, and an effectiveness read. JSON only.`;

// 3. Call DeepSeek exactly as the provider (max_tokens 8000, json_object). No client timeout here so we see the
//    TRUE latency (the provider caps at 45s — if the real call exceeds it, THAT is the transient cause).
const t0 = Date.now();
const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], max_tokens: 8000, response_format: { type: "json_object" } }),
});
const ms = Date.now() - t0;
if (!res.ok) { console.log(`DeepSeek HTTP ${res.status} in ${(ms/1000).toFixed(1)}s: ${(await res.text()).slice(0,300)}`); process.exit(0); }
const j = await res.json();
const choice = j.choices?.[0];
const content = choice?.message?.content ?? "";
const reasoning = choice?.message?.reasoning_content ?? "";
console.log(`\nDeepSeek responded in ${(ms/1000).toFixed(1)}s (provider timeout is 45s)`);
console.log(`finish_reason: ${choice?.finish_reason}`);
console.log(`usage: ${JSON.stringify(j.usage)}`);
console.log(`reasoning_content: ${reasoning.length} chars   answer content: ${content.length} chars`);
let parseOk = false; try { JSON.parse(content); parseOk = true; } catch {}
console.log(`answer parses as JSON: ${parseOk}`);
console.log(`answer preview: ${content.slice(0, 300)}`);
process.exit(0);
