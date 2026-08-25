#!/usr/bin/env node
// READ-ONLY: is the pitch-processing cron actually sweeping every minute? Direct DB signals, no Vercel logs needed:
//  (1) STUCK pitches — status in a processing state with run_after in the PAST (due) but not advancing. If any are
//      old, the cron is NOT claiming them (a gap). (2) For slow COMPLETE pitches (created->updated large) with low
//      attempts, the time was QUEUE WAIT (cron/kick gap), not retry churn. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const nowIso = new Date().toISOString();

// (1) currently-due-but-unclaimed pitches
const { data: due } = await sb
  .from("pitches")
  .select("id, status, attempts, run_after, created_at, updated_at")
  .in("status", ["uploading", "recorded", "transcribing", "analyzing"])
  .lte("run_after", nowIso)
  .order("run_after", { ascending: true })
  .limit(50);
console.log(`\n(1) DUE-but-unclaimed right now (status processing + run_after<=now): ${due?.length ?? 0}`);
for (const p of (due ?? []).slice(0, 12)) {
  const ageMin = ((Date.now() - new Date(p.run_after)) / 60000).toFixed(0);
  console.log(`  id=${String(p.id).slice(0, 8)} ${String(p.status).padEnd(12)} att=${p.attempts} due ${ageMin}m ago`);
}
if ((due ?? []).length === 0) console.log("  (none stuck — either all processed, or none pending right now)");

// (2) slow complete pitches: queue wait (low attempts, high latency) vs retry churn
const { data: comp } = await sb
  .from("pitches")
  .select("id, attempts, created_at, updated_at")
  .eq("status", "complete")
  .gte("created_at", "2026-08-11T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(500);
const rows = (comp ?? []).map((p) => ({ ...p, latMin: (new Date(p.updated_at) - new Date(p.created_at)) / 60000 })).filter((p) => p.latMin >= 0 && p.latMin < 600);
const slow = rows.filter((p) => p.latMin > 5).sort((a, b) => b.latMin - a.latMin);
console.log(`\n(2) COMPLETE pitches >5min latency: ${slow.length}/${rows.length}`);
for (const p of slow.slice(0, 12)) {
  console.log(`  id=${String(p.id).slice(0, 8)} lat=${p.latMin.toFixed(1)}m attempts=${p.attempts}  ${p.attempts <= 1 ? "← low attempts → QUEUE WAIT (cron/kick gap), not churn" : "(retry churn)"}`);
}
process.exit(0);
