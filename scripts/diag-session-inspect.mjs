#!/usr/bin/env node
// READ-ONLY: deep-inspect ONE coaching session end-to-end — to verify a founder test call captured everything
// (transcript + incremental audio chunks + generation). Arg = a session UUID, OR a rep-name substring (→ that
// rep's most recent session). Confirms the 2026-08-21 capture fixes on a real session. NO writes.
//
//   node scripts/diag-session-inspect.mjs <session-uuid | rep-name>   (pass repo root as $2 if not cwd-run)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arg = (process.argv[2] || "").trim();
const root = process.argv[3] || ".";
if (!arg) { console.error("usage: diag-session-inspect.mjs <session-uuid | rep-name>"); process.exit(1); }
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
  if (!ids.length) { console.error(`no rep matches "${arg}"`); process.exit(1); }
  const { data } = await sb.from("coaching_sessions").select("*").in("agent_id", ids).order("started_at", { ascending: false }).limit(1).maybeSingle();
  session = data;
}
if (!session) { console.error("no session found"); process.exit(1); }

const durMin = session.ended_at ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000) : null;
console.log(`\n=== session ${session.id} ===`);
console.log(`context=${session.context}  status=${session.status}  started=${session.started_at?.slice(0, 16)}  dur=${durMin ?? "?"}m`);
console.log(`audio_asset_url = ${session.audio_asset_url ?? "— (none)"}`);

// Transcript
const { data: segs } = await sb.from("coaching_transcript_segments").select("speaker, source, seq").eq("session_id", session.id).order("seq");
const by = { agent: 0, customer: 0, unknown: 0 };
const src = {};
for (const s of segs ?? []) { by[s.speaker] = (by[s.speaker] ?? 0) + 1; if (s.source) src[s.source] = (src[s.source] ?? 0) + 1; }
console.log(`\nTRANSCRIPT: ${segs?.length ?? 0} segments  (agent=${by.agent} customer=${by.customer} unknown=${by.unknown})`);
console.log(`  attribution source:`, Object.keys(src).length ? src : "(none recorded)");

// Incremental AUDIO chunks (proves the 2026-08-21 incremental upload worked) + final recording.
const chunkPrefix = `${session.company_id}/${session.id}/chunks`;
const { data: chunkObjs } = await sb.storage.from(ASSETS_BUCKET).list(chunkPrefix, { limit: 2000 });
const { data: recObjs } = await sb.storage.from(ASSETS_BUCKET).list(`${session.company_id}/${session.id}`, { limit: 50 });
console.log(`\nAUDIO: ${chunkObjs?.length ?? 0} chunk objects uploaded under ${chunkPrefix}/`);
const rec = (recObjs ?? []).find((o) => o.name === "recording.webm");
console.log(`  final recording.webm: ${rec ? `${Math.round((rec.metadata?.size ?? 0) / 1024)} KB` : "— (not stitched yet)"}`);

// Generation
const subject = `sales_session:${session.id}`;
const { data: ev } = await sb.from("events").select("kind, occurred_at").eq("subject", subject).order("occurred_at");
console.log(`\nGENERATION events:`);
if (!ev?.length) console.log("  (none)");
for (const e of ev ?? []) console.log(`  ${e.occurred_at?.slice(0, 16)}  ${e.kind}`);

// After-pitch summary row
const { count: apCount } = await sb.from("after_pitch_summaries").select("id", { count: "exact", head: true }).eq("session_id", session.id);
console.log(`\nafter_pitch_summaries rows: ${apCount ?? 0}`);
console.log(`\nVERDICT: transcript=${(segs?.length ?? 0) > 0 ? "YES" : "NO"}  audio=${session.audio_asset_url || rec ? "YES" : (chunkObjs?.length ? "chunks-only (stitch pending)" : "NO")}  dissect=${(ev ?? []).some((e) => e.kind === "coach.dissect_generated") ? "YES" : "NO"}`);
