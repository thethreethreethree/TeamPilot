#!/usr/bin/env node
// READ-ONLY diagnostic (2026-08-19): why do monitored session transcripts label EVERY
// turn "agent" even though the client clearly spoke? (founder-reported, Humza's sessions).
//
// Retrospective (§1.2): pull the ACTUAL record — recent coaching_sessions, their stored
// transcript speaker distribution, whether they carry a saved recording (upload/recovery
// path vs pure-live), and the diarization cluster count cached by /retranscribe — and
// correlate. This disambiguates the three ways a transcript reaches all-"agent":
//
//   #1 single-cluster batch diarization  → all-agent AND has audio AND cache shows 1 cluster
//   #2 live-attribution collapse          → all-agent AND NO audio (pure live), far-mic prospect
//   #3 manual "I'm speaking" lock left ON → all-agent, pure live, but OTHER reps/sessions DO split
//
// NO writes. Optional argv[2] = case-insensitive agent-name substring filter (e.g. "Humza").
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const nameFilter = (process.argv[2] || "").trim().toLowerCase();

// 1) Recent sessions (newest first). audio_asset_url tells us upload/recovery vs pure-live.
const { data: sessions, error: sErr } = await sb
  .from("coaching_sessions")
  .select("id, company_id, agent_id, context, status, started_at, audio_asset_url")
  .order("started_at", { ascending: false })
  .limit(300);
if (sErr) { console.error("sessions query failed:", sErr.message); process.exit(1); }

// Rep names (for the filter + readable output).
const agentIds = [...new Set(sessions.map((s) => s.agent_id))];
const { data: profs } = await sb.from("profiles").select("id, full_name").in("id", agentIds);
const nameById = new Map((profs || []).map((p) => [p.id, p.full_name || "Unnamed"]));

const scoped = nameFilter
  ? sessions.filter((s) => (nameById.get(s.agent_id) || "").toLowerCase().includes(nameFilter))
  : sessions;
const sessionIds = scoped.map((s) => s.id);
console.log(`\n=== ${scoped.length} sessions${nameFilter ? ` matching "${nameFilter}"` : ""} (of ${sessions.length} recent) ===`);
if (sessionIds.length === 0) process.exit(0);

// 2) All their transcript segments' speaker values — paginated past the 1000-row PostgREST cap
//    (per the unbounded-.select() truncation class) so the per-session tallies are correct.
const speakerBySession = new Map(); // sid -> { agent, customer, unknown, other, total }
for (let from = 0; ; from += 1000) {
  const { data: segs, error: segErr } = await sb
    .from("coaching_transcript_segments")
    .select("session_id, speaker")
    .in("session_id", sessionIds)
    .range(from, from + 999);
  if (segErr) { console.error("segments query failed:", segErr.message); process.exit(1); }
  for (const seg of segs || []) {
    const t = speakerBySession.get(seg.session_id) || { agent: 0, customer: 0, unknown: 0, other: 0, total: 0 };
    const k = seg.speaker === "agent" || seg.speaker === "customer" || seg.speaker === "unknown" ? seg.speaker : "other";
    t[k] += 1; t.total += 1;
    speakerBySession.set(seg.session_id, t);
  }
  if (!segs || segs.length < 1000) break;
}

// 3) Retranscribe-cache cluster counts — how many distinct diarization clusters ElevenLabs
//    actually returned for each session's recording (1 cluster ⇒ couldn't separate ⇒ cause #1).
const { data: caches } = await sb
  .from("coaching_retranscribe_cache")
  .select("session_id, result")
  .in("session_id", sessionIds);
const clusterCountBySession = new Map();
for (const c of caches || []) {
  const segs = c.result?.segments;
  const n = Array.isArray(segs) ? new Set(segs.map((s) => s.speakerId)).size : null;
  clusterCountBySession.set(c.session_id, n);
}

// 4) Per-session lines + aggregate tallies for the three causes.
let allAgent = 0, allAgentWithAudio = 0, allAgentPureLive = 0, splitOk = 0, emptyT = 0;
const singleClusterHits = [];
console.log(`\n${"session".padEnd(10)} ${"rep".padEnd(14)} ${"ctx".padEnd(9)} audio  clusters  speakers`);
for (const s of scoped) {
  const t = speakerBySession.get(s.id);
  const hasAudio = !!s.audio_asset_url;
  const clusters = clusterCountBySession.has(s.id) ? clusterCountBySession.get(s.id) : "-";
  if (!t || t.total === 0) { emptyT++; }
  else if (t.customer === 0 && t.agent > 0) {
    allAgent++;
    if (hasAudio) allAgentWithAudio++; else allAgentPureLive++;
    if (clusters === 1) singleClusterHits.push(s.id.slice(0, 8));
  } else if (t.customer > 0 && t.agent > 0) splitOk++;

  const spk = t ? `a:${t.agent} c:${t.customer} u:${t.unknown}${t.other ? ` o:${t.other}` : ""}` : "(no transcript)";
  const flag = t && t.total > 0 && t.customer === 0 && t.agent > 0 ? "  ⚠ ALL-AGENT" : "";
  console.log(
    `${s.id.slice(0, 8).padEnd(10)} ${(nameById.get(s.agent_id) || "?").slice(0, 13).padEnd(14)} ` +
    `${(s.context || "null").padEnd(9)} ${(hasAudio ? "yes" : "no ").padEnd(5)} ${String(clusters).padEnd(9)} ${spk}${flag}`
  );
}

console.log(`\n=== TALLY ===`);
console.log(`all-agent (customer=0, agent>0): ${allAgent}   properly split: ${splitOk}   empty transcript: ${emptyT}`);
console.log(`  of all-agent → WITH saved audio (upload/recovery path): ${allAgentWithAudio}`);
console.log(`  of all-agent → pure-live (no saved audio):              ${allAgentPureLive}`);
console.log(`  of all-agent → retranscribe cache shows a SINGLE cluster: ${singleClusterHits.length}` +
  (singleClusterHits.length ? ` [${singleClusterHits.join(", ")}]` : ""));
console.log(`\nREAD: many all-agent WITH-audio + single-cluster  ⇒ cause #1 (batch diarization couldn't split — fix in retranscribe/label).`);
console.log(`      many all-agent PURE-LIVE                     ⇒ cause #2/#3 (live attribution collapse or manual "I'm speaking" lock).`);
console.log(`      if the SAME rep also has properly-split sessions ⇒ argues against a universal toggle habit (#3).`);
process.exit(0);
