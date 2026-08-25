#!/usr/bin/env node
// READ-ONLY: read the client-side CaptureDiag events (events.kind='doorlog.capture_failed') for the company whose
// pitches produced 5-byte stub recordings, around the failure window. Names the ACTUAL client cause of the empty
// capture (wake lock not granted / mic track ended / no data / mimeType) from data — not assumption. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from("events")
  .select("created_at, actor, payload")
  .eq("kind", "doorlog.capture_failed")
  .eq("company_id", "28203036-6b05-488a-b62d-714033e87cd5")
  .gte("created_at", "2026-08-24T17:00:00Z")
  .order("created_at", { ascending: false })
  .limit(30);
if (error) { console.log("query error:", error.message); process.exit(1); }
const rows = data ?? [];
console.log(`\n${rows.length} capture_failed event(s) for this company since 08-24 17:00:\n`);
for (const r of rows) {
  const p = r.payload ?? {};
  console.log(`  ${String(r.created_at).slice(5, 16)} actor=${String(r.actor).slice(0, 8)}`);
  console.log(`    sawData=${p.sawData} chunkCount=${p.chunkCount} chunksUploaded=${p.chunksUploaded} durMs=${p.durationMs}`);
  console.log(`    mime="${p.mimeType}" recErr=${p.recorderError ?? "-"} trackEnded=${p.trackEnded} trackMuted=${p.trackMuted} wakeLock=${p.wakeLockGranted} hidden=${p.hiddenDuringRecording}`);
  if (p.ua) console.log(`    ua=${String(p.ua).slice(0, 100)}`);
}
process.exit(0);
