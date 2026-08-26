#!/usr/bin/env node
// READ-ONLY P0: what is the CLIENT reporting when a DoorLog capture comes back empty? Reads the doorlog.capture_failed
// telemetry events (shipped 8d760f46: sawData / chunkCount / chunksUploaded / mimeType / recorderError / trackEnded /
// trackMuted / wakeLockGranted / hiddenDuringRecording / ua) across ALL companies for the last 48h, newest first.
// This names the ROOT of the empty capture from data — NOT assumption. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

const { data, error } = await sb
  .from("events")
  .select("created_at, company_id, actor, payload")
  .in("kind", ["doorlog.capture_failed", "coach.capture_failed"])
  .gte("created_at", since)
  .order("created_at", { ascending: false })
  .limit(60);
if (error) { console.log("query error:", error.message); process.exit(1); }
const rows = data ?? [];
console.log(`\n${rows.length} capture_failed event(s) in the last 48h:\n`);
const uaTally = {};
const mimeTally = {};       // which container each failure used
const iosMimeTally = {};    // iOS-only, by mime — post-fix this should shift OFF audio/webm to audio/mp4 (or vanish)
for (const r of rows) {
  const p = r.payload ?? {};
  const ua = String(p.ua ?? "");
  const os = /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Win" : "?";
  uaTally[os] = (uaTally[os] ?? 0) + 1;
  const mime = String(p.mimeType ?? "?");
  mimeTally[mime] = (mimeTally[mime] ?? 0) + 1;
  if (os === "iOS") iosMimeTally[mime] = (iosMimeTally[mime] ?? 0) + 1;
  console.log(`  ${String(r.created_at).slice(5, 16)} co=${String(r.company_id).slice(0, 8)} rep=${String(r.actor).slice(0, 8)} [${os}] surface=${p.surface ?? "doorlog"}`);
  console.log(`    sawData=${p.sawData} chunkCount=${p.chunkCount} chunksUploaded=${p.chunksUploaded} durMs=${p.durationMs} blobBytes=${p.blobSize ?? p.capturedBytes ?? "?"}`);
  console.log(`    mime="${p.mimeType}" recErr=${p.recorderError ?? "-"} trackEnded=${p.trackEnded} trackMuted=${p.trackMuted} wakeLock=${p.wakeLockGranted} hidden=${p.hiddenDuringRecording} trackState=${p.trackReadyState ?? "?"}`);
  if (ua) console.log(`    ua=${ua.slice(0, 120)}`);
}
console.log(`\nOS tally:    ${JSON.stringify(uaTally)}`);
console.log(`mime tally:  ${JSON.stringify(mimeTally)}`);
// Loop-close for the 2026-08-27 iOS webm-stub fix (f31b59c0): iOS failures should now be OFF audio/webm. If
// audio/webm iOS failures KEEP appearing after reps update, the mp4 preference isn't taking — re-open with data.
console.log(`iOS by mime: ${JSON.stringify(iosMimeTally)}   (post-fix: iOS should be audio/mp4 or gone, NOT audio/webm)`);
// capturedBytes (added to the door-log capture-diag schema 2026-08-27) distinguishes a real-audio-upload-failure
// (large) from a container STUB (tiny, <1KB) — shown on the blobBytes= line above per event.
process.exit(0);
