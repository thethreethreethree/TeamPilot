// VERIFY the recovered meeting actually transcribes (proof before telling the founder it's fixed). Downloads the
// stitched recording.webm and POSTs it to ElevenLabs Scribe exactly as the app does. Read-only (no DB writes).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const company = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7", sid = "d5ed4699-f766-47e4-af7f-2161e5b087a7";
const path = `${company}/${sid}/recording.webm`;

const { data, error } = await sb.storage.from("assets-v1").download(path);
if (error || !data) { console.error("download failed:", error?.message); process.exit(1); }
const bytes = Buffer.from(await data.arrayBuffer());
console.log(`recording.webm = ${(bytes.length/1024/1024).toFixed(2)} MB — POSTing to ElevenLabs Scribe (diarized)…`);

const form = new FormData();
form.append("file", new Blob([bytes], { type: "audio/webm" }), "recording.webm");
form.append("model_id", "scribe_v1");
form.append("diarize", "true");
const t0 = Date.now();
const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
  method: "POST",
  headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
  body: form,
});
const took = ((Date.now() - t0) / 1000).toFixed(1);
if (!res.ok) { console.error(`STT HTTP ${res.status} in ${took}s:`, (await res.text()).slice(0, 400)); process.exit(1); }
const json = await res.json();
const text = json.text ?? "";
const words = json.words ?? [];
const speakers = new Set(words.map((w) => w.speaker_id).filter(Boolean));
console.log(`\n✅ TRANSCRIBED in ${took}s`);
console.log(`   characters: ${text.length}  words: ${words.length}  speakers detected: ${speakers.size || "?"}`);
console.log(`   first 400 chars: ${text.slice(0, 400).replace(/\s+/g, " ")}`);
console.log(`   last 200 chars:  ${text.slice(-200).replace(/\s+/g, " ")}`);
process.exit(0);
