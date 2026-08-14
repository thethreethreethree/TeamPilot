#!/usr/bin/env node
// READ-ONLY diagnostic (2026-08-14): why does live coaching show "Realtime connection error"?
// Mints a realtime STT token (single-use-token/realtime_scribe) exactly as the app does, then opens the
// Scribe v2 Realtime WebSocket exactly as useLiveCoaching.ts does, and reports the close code/reason.
// Sends NO audio → no transcription characters billed. NO writes.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const key = env.ELEVENLABS_API_KEY;
if (!key) { console.error("ELEVENLABS_API_KEY not in .env.local"); process.exit(1); }
console.log("key prefix:", key.slice(0, 6) + "…", "len", key.length);

// 1) subscription (tier)
try {
  const sub = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
  const sj = await sub.json().catch(() => ({}));
  console.log(`\n[subscription] HTTP ${sub.status} tier=${sj.tier ?? "?"} status=${sj.status ?? "?"} ` +
    `chars=${sj.character_count ?? "?"}/${sj.character_limit ?? "?"}`);
} catch (e) { console.log("[subscription] error", e.message); }

// 2) mint the realtime token (the exact op the app uses)
let token;
const mint = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
  method: "POST", headers: { "xi-api-key": key, Accept: "application/json" },
});
const mintBody = await mint.text();
console.log(`\n[mint realtime_scribe] HTTP ${mint.status} body=${mintBody.slice(0, 200)}`);
if (!mint.ok) { console.error("→ TOKEN MINT FAILED — this is the failure (scope/plan)."); process.exit(0); }
try { token = JSON.parse(mintBody).token; } catch { console.error("no token in body"); process.exit(0); }
console.log("→ token minted OK, len", token?.length);

// 3) open the WS exactly as useLiveCoaching.ts does
const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=${encodeURIComponent(token)}` +
  `&model_id=scribe_v2_realtime&commit_strategy=vad&audio_format=pcm_16000`;
console.log("\n[ws] connecting to speech-to-text/realtime?model_id=scribe_v2_realtime …");
const ws = new WebSocket(url);
const done = (code) => setTimeout(() => process.exit(code), 200);
ws.onopen = () => { console.log("→ WS OPEN ✓ — realtime STT connects fine (handshake OK)."); ws.close(); done(0); };
ws.onerror = (e) => { console.log("→ WS ERROR:", e.message ?? e.error?.message ?? "(no message)"); };
ws.onclose = (e) => { console.log(`→ WS CLOSE code=${e.code} reason="${e.reason || "(none)"}"`); done(0); };
ws.onmessage = (e) => { const s = typeof e.data === "string" ? e.data : ""; console.log("→ WS MSG:", s.slice(0, 200)); };
setTimeout(() => { console.log("→ timed out after 12s with no open/close"); process.exit(0); }, 12000);
