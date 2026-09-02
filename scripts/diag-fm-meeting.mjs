// READ-ONLY forensic: find the founder's recent meeting/huddle sessions and show their real capture state
// (durable audio chunks in storage, stitched audio_asset_url, transcript segments, cues). NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: rows, error } = await sb.from("coaching_sessions")
  .select("id, agent_id, company_id, session_kind, client_label, status, audio_asset_url, audio_duration_seconds, recording_saved, started_at, ended_at, created_at")
  .in("session_kind", ["meeting", "huddle"])
  .order("started_at", { ascending: false }).limit(8);
if (error) { console.error("query error:", error.message); process.exit(1); }

for (const s of rows ?? []) {
  const dur = s.ended_at ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000) : null;
  const { data: prof } = await sb.from("profiles").select("full_name, email").eq("id", s.agent_id).maybeSingle();
  console.log(`\n=== ${s.client_label} [${s.session_kind}] ${s.id}`);
  console.log(`   owner=${prof?.full_name || prof?.email || s.agent_id}  status=${s.status}  wallclock=${dur ?? "?"}m  started=${s.started_at?.slice(0, 16)}  created=${s.created_at?.slice(0, 16)}`);
  console.log(`   audio_asset_url=${s.audio_asset_url ?? "— NONE"}  audio_dur_s=${s.audio_duration_seconds ?? "—"}  recording_saved=${s.recording_saved}`);
  // Look for durable audio chunks in a few likely path shapes.
  for (const prefix of [`${s.company_id}/sessions/${s.id}`, `${s.company_id}/coaching/${s.id}`, `${s.company_id}/${s.id}`]) {
    const { data: files } = await sb.storage.from("assets-v1").list(prefix, { limit: 300 });
    if (files && files.length) {
      console.log(`   storage[${prefix}]: ${files.length} objects → ${files.slice(0, 5).map((f) => `${f.name}(${f.metadata?.size ?? "?"}b)`).join(", ")}${files.length > 5 ? " …" : ""}`);
    }
  }
  const { count: segCount } = await sb.from("coaching_transcript_segments").select("id", { count: "exact", head: true }).eq("session_id", s.id);
  const { count: cueCount } = await sb.from("coaching_cues").select("id", { count: "exact", head: true }).eq("session_id", s.id);
  console.log(`   transcript_segments=${segCount ?? "?"}  cues=${cueCount ?? "?"}`);
}
process.exit(0);
