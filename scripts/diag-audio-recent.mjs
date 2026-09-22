#!/usr/bin/env node
// READ-ONLY: is the audio-save ACTUALLY broken, or is the historical no-audio just the 2-day purge nulling
// audio_asset_url? The only UNCONFOUNDED signal is sessions younger than the RETENTION_DAYS=2 purge window.
// Check the last ~40h: of ended sessions with a real transcript (=> a real call that likely reached Stop),
// how many have audio_asset_url? If most DO → persist works, historical no-audio = purge. If most DON'T →
// real clean-Stop persist bug. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (const hours of [40, 24, 12]) {
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("id, status, started_at, ended_at, audio_asset_url, recording_saved")
    .gte("started_at", since)
    .order("started_at", { ascending: false });
  if (error) { console.log(`last ${hours}h: query error ${error.message}`); continue; }
  const rows = data ?? [];
  const withAudio = rows.filter((r) => r.audio_asset_url).length;
  const ended = rows.filter((r) => r.status === "ended" || r.status === "reviewed").length;
  const dur = (r) => r.ended_at ? Math.round((new Date(r.ended_at) - new Date(r.started_at)) / 60000) : null;
  console.log(`\nlast ${hours}h (unpurged window): ${rows.length} sessions, ${ended} ended, ${withAudio} WITH audio_asset_url`);
  for (const r of rows.slice(0, 12)) {
    console.log(`  ${r.started_at.slice(5, 16)}  ${String(r.status).padEnd(8)} dur=${dur(r) ?? "?"}m  audio=${r.audio_asset_url ? "YES" : "—"}  saved=${r.recording_saved ?? "?"}`);
  }
}
