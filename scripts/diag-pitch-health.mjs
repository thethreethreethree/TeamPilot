#!/usr/bin/env node
// READ-ONLY: DoorLog / Macro Mode pitch-pipeline health (§1.2 retrospective, adjacent to the Live-Coach
// capture audit). A door pitch flows: recorded → uploading → transcribing → analyzing → complete, processed
// by the worker (fire-and-forget kick + every-minute cron). This surfaces stuck/failed/inconsistent pitches
// the same way diag-session-health did for coaching sessions. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const since = new Date(Date.now() - 30 * 864e5).toISOString();
const { data: pitches, error } = await sb
  .from("pitches")
  .select("id, status, attempts, error, audio_path, created_at, run_after")
  .gte("created_at", since)
  .order("created_at", { ascending: false })
  .limit(1000);
if (error) { console.error("pitches:", error.message); process.exit(1); }
console.log(`\n=== ${pitches.length} pitches (30d) ===`);

const byStatus = {};
let noAudio = 0, staleProcessing = 0;
const now = Date.now();
const PROCESSING = ["uploading", "recorded", "transcribing", "analyzing"];
for (const p of pitches) {
  byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  if (!p.audio_path) noAudio += 1;
  // "stuck" = still in a processing state but created >30 min ago (the worker should have advanced it by now).
  if (PROCESSING.includes(p.status) && (now - new Date(p.created_at).getTime()) > 30 * 60_000) staleProcessing += 1;
}
const n = pitches.length || 1;
const pct = (x) => `${x} (${Math.round((x / n) * 100)}%)`;
console.log("by status:", byStatus);
console.log(`no audio_path:        ${pct(noAudio)}`);
console.log(`STUCK processing >30m: ${pct(staleProcessing)}  (worker should have advanced these)`);

// Failed pitches — the honest terminal state. Sample the error messages to see WHY.
const failed = pitches.filter((p) => p.status === "failed");
console.log(`\nFAILED: ${pct(failed.length)}`);
const errSample = {};
for (const p of failed) {
  const key = (p.error ?? "(no error text)").slice(0, 70);
  errSample[key] = (errSample[key] ?? 0) + 1;
}
for (const [e, c] of Object.entries(errSample).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${c}× ${e}`);

// Consistency: a 'complete' pitch should have BOTH a transcript and an analysis row.
const complete = pitches.filter((p) => p.status === "complete").map((p) => p.id);
if (complete.length) {
  const haveTr = new Set(), haveAn = new Set();
  for (let i = 0; i < complete.length; i += 50) {
    const chunk = complete.slice(i, i + 50);
    const { data: tr } = await sb.from("pitch_transcripts").select("pitch_id").in("pitch_id", chunk);
    const { data: an } = await sb.from("pitch_analyses").select("pitch_id").in("pitch_id", chunk);
    for (const r of tr ?? []) haveTr.add(r.pitch_id);
    for (const r of an ?? []) haveAn.add(r.pitch_id);
  }
  const noTr = complete.filter((id) => !haveTr.has(id)).length;
  const noAn = complete.filter((id) => !haveAn.has(id)).length;
  console.log(`\ncomplete pitches: ${complete.length}  — missing transcript: ${noTr}  missing analysis: ${noAn}  (both should be 0)`);
}
