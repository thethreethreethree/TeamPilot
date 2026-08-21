#!/usr/bin/env node
// READ-ONLY: verify ONE Meeting Coach session captured correctly — for the founder device-validation run
// (docs/MEETINGCOACH-DEVICE-VALIDATION.md). A meeting is a coaching_sessions row with session_kind meeting|huddle;
// unlike a sales call it does NOT persist a transcript (the durable audio is re-transcribed for Dissect later),
// so this checks the RIGHT things for a meeting: kind, the recorded CUES, and the durable AUDIO. NO writes.
//
//   node scripts/diag-meeting-session.mjs <session-uuid | facilitator-name>   (repo root as $2 if not cwd-run)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arg = (process.argv[2] || "").trim();
const root = process.argv[3] || ".";
if (!arg) { console.error("usage: diag-meeting-session.mjs <session-uuid | facilitator-name>"); process.exit(1); }
const env = Object.fromEntries(readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ASSETS_BUCKET = "assets-v1";

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg);
let session;
if (isUuid) {
  const { data } = await sb.from("coaching_sessions").select("*").eq("id", arg).maybeSingle();
  session = data;
} else {
  const { data: profs } = await sb.from("profiles").select("id, full_name").ilike("full_name", `%${arg}%`);
  const ids = (profs ?? []).map((p) => p.id);
  if (!ids.length) { console.error(`no user matches "${arg}"`); process.exit(1); }
  // Prefer a meeting/huddle session if this person has one; else their most recent session of any kind.
  const { data: mtg } = await sb.from("coaching_sessions").select("*").in("agent_id", ids).in("session_kind", ["meeting", "huddle"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (mtg) session = mtg;
  else { const { data } = await sb.from("coaching_sessions").select("*").in("agent_id", ids).order("started_at", { ascending: false }).limit(1).maybeSingle(); session = data; }
}
if (!session) { console.error("no session found"); process.exit(1); }

const kind = session.session_kind ?? "sales";
const durMin = session.ended_at ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000) : null;
console.log(`\n=== session ${session.id} ===`);
console.log(`session_kind=${kind}${kind === "sales" ? "  ⚠ NOT a meeting/huddle — is 0237 applied + did you use /dashboard/meeting-coach?" : ""}`);
console.log(`context=${session.context}  status=${session.status}  started=${session.started_at?.slice(0, 16)}  dur=${durMin ?? "?"}m`);

// Cues delivered (coaching_cues) — the meeting brain's output.
const { data: cues } = await sb.from("coaching_cues").select("mode, text, trigger, latency_ms, created_at").eq("session_id", session.id).order("created_at");
console.log(`\nCUES DELIVERED: ${cues?.length ?? 0}`);
for (const c of (cues ?? []).slice(0, 8)) {
  console.log(`  [${c.trigger ?? "?"}/${c.mode}] ${c.latency_ms ?? "?"}ms  "${(c.text ?? "").slice(0, 80)}"`);
}
if ((cues?.length ?? 0) > 8) console.log(`  … +${cues.length - 8} more`);

// Durable AUDIO — incremental chunks (during the call) + the final stitched/persisted recording.
const chunkPrefix = `${session.company_id}/${session.id}/chunks`;
const { data: chunkObjs } = await sb.storage.from(ASSETS_BUCKET).list(chunkPrefix, { limit: 2000 });
const { data: recObjs } = await sb.storage.from(ASSETS_BUCKET).list(`${session.company_id}/${session.id}`, { limit: 50 });
const rec = (recObjs ?? []).find((o) => o.name === "recording.webm");
console.log(`\nAUDIO:`);
console.log(`  audio_asset_url = ${session.audio_asset_url ?? "— (none — clean-Stop persist didn't run / not stitched yet)"}`);
console.log(`  incremental chunks uploaded: ${chunkObjs?.length ?? 0} under ${chunkPrefix}/`);
console.log(`  final recording.webm: ${rec ? `${Math.round((rec.metadata?.size ?? 0) / 1024)} KB` : "— (not stitched yet; auto-close-stale cron stitches a never-Stopped session within 6h)"}`);

// Meeting-appropriate verdict: for a meeting, transcript + dissect being absent is EXPECTED (not a failure).
const audioOk = !!session.audio_asset_url || !!rec || (chunkObjs?.length ?? 0) > 0;
const cuesOk = (cues?.length ?? 0) > 0;
console.log(`\nVERDICT (meeting):`);
console.log(`  kind correct = ${kind === "meeting" || kind === "huddle" ? "YES" : "NO — see warning above"}`);
console.log(`  cues fired   = ${cuesOk ? "YES" : "NO — did the brain stay silent, or did the /cue POST fail? check console/network"}`);
console.log(`  audio saved  = ${session.audio_asset_url || rec ? "YES (recording.webm)" : (chunkObjs?.length ? "chunks-only (stitch pending — re-run after the cron, or after a clean Stop)" : "NO — recorder didn't upload; check /audio-chunk network calls")}`);
console.log(`\n(For a meeting, transcript + Dissect are intentionally absent — the durable audio is re-transcribed for Dissect later.)`);
