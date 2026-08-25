#!/usr/bin/env node
// Re-queue the terminally-FAILED corrupted-audio pitches so the bad-concat recovery (b5cdb61d) can salvage them.
// Founder-approved 2026-08-25 (AskUserQuestion "Re-queue the 4"). DRY-RUN by default; pass --apply to mutate.
//
// Target set: pitches with status='failed' AND error ILIKE '%corrupted%' (the ElevenLabs "File is corrupted"
// failures). Reset each to {status:'recorded', attempts:0, error:null, run_after:<past>} — the exact shape the
// claim sweep (claimPitchesToProcess: status IN uploading/recorded/transcribing/analyzing AND run_after<=now)
// picks up. The worker then re-downloads the cached recording, STT rejects the bad concat, the recovery truncates
// to the first segment and retries → the bad-concat ones COMPLETE, any genuinely-corrupt one re-fails honestly.
//
// Preview and mutation target the SAME ids (select first, update WHERE id IN those ids) so they cannot drift.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const root = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1. Select the target set (the identity the mutation will use).
const { data: targets, error: selErr } = await sb
  .from("pitches")
  .select("id, company_id, rep_id, recorded_at, attempts, audio_path, error")
  .eq("status", "failed")
  .ilike("error", "%corrupted%")
  .order("recorded_at", { ascending: false });
if (selErr) {
  console.log("select error:", selErr.message);
  process.exit(1);
}
const rows = targets ?? [];
console.log(`\n${APPLY ? "APPLY" : "DRY-RUN"} — ${rows.length} corrupted-audio 'failed' pitch(es) targeted:\n`);
for (const r of rows) {
  console.log(
    `  ${String(r.recorded_at ?? "?").slice(0, 16)}  id=${String(r.id).slice(0, 8)}  rep=${String(r.rep_id).slice(0, 8)}  att=${r.attempts}  audio=${r.audio_path ? "yes" : "NONE"}`
  );
}
if (rows.length === 0) {
  console.log("Nothing to re-queue.");
  process.exit(0);
}

const ids = rows.map((r) => r.id);
const reset = { status: "recorded", attempts: 0, error: null, run_after: new Date(0).toISOString() };
console.log(`\nWould reset each to: ${JSON.stringify(reset)}`);

if (!APPLY) {
  console.log("\nDRY-RUN only. Re-run with --apply to perform the reset.");
  process.exit(0);
}

// 2. Mutate EXACTLY the previewed ids (re-scoped to status='failed' so a concurrent change can't clobber a
//    pitch that already moved on).
const { data: updated, error: updErr } = await sb
  .from("pitches")
  .update(reset)
  .in("id", ids)
  .eq("status", "failed")
  .select("id");
if (updErr) {
  console.log("update error:", updErr.message);
  process.exit(1);
}
console.log(`\nAPPLIED — reset ${updated?.length ?? 0} pitch(es). The pitch-processing cron (every minute) will reprocess them.`);
