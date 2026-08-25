#!/usr/bin/env node
// READ-ONLY: measure the ACTUAL after-pitch feedback latency + WHERE it comes from. The worker retries with
// exponential backoff (30s·2^n → 60,120,240,480s ≈ 15min cumulative for a full 5-attempt fail), so latency is
// dominated by ATTEMPTS. Reports, for recent pitches: created→completed latency (avg/p50/p90) split by attempts,
// the attempts distribution, and the transient-retry rate. Names the cause from data, not assumption. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from("pitches")
  .select("id, status, attempts, error, created_at, updated_at, recorded_at")
  .gte("created_at", "2026-08-11T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(1000);
if (error) { console.log("query error:", error.message); process.exit(1); }
const rows = data ?? [];
console.log(`\n${rows.length} pitches since 08-11`);

// status + attempts distribution
const statusM = {}, attemptsM = {};
for (const p of rows) { statusM[p.status] = (statusM[p.status] ?? 0) + 1; attemptsM[p.attempts ?? 0] = (attemptsM[p.attempts ?? 0] ?? 0) + 1; }
console.log(`  status:   ${JSON.stringify(statusM)}`);
console.log(`  attempts: ${JSON.stringify(attemptsM)}`);

// latency for terminal pitches (complete OR failed): created -> updated (last status change)
const pct = (arr, p) => arr.length ? arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0;
function report(label, subset) {
  const mins = subset.map((p) => (new Date(p.updated_at) - new Date(p.created_at)) / 60000).filter((m) => m >= 0 && m < 240);
  if (!mins.length) { console.log(`  ${label}: (no measurable latencies)`); return; }
  const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
  console.log(`  ${label}: n=${mins.length}  avg=${avg.toFixed(1)}m  p50=${pct(mins, 0.5).toFixed(1)}m  p90=${pct(mins, 0.9).toFixed(1)}m  max=${Math.max(...mins).toFixed(1)}m`);
}
const complete = rows.filter((p) => p.status === "complete");
const failed = rows.filter((p) => p.status === "failed");
console.log(`\nLatency (created -> updated):`);
report("COMPLETE (all)", complete);
report("  complete attempts<=1", complete.filter((p) => (p.attempts ?? 0) <= 1));
report("  complete attempts>=2", complete.filter((p) => (p.attempts ?? 0) >= 2));
report("FAILED (all)", failed);

// transient-retry signal: of terminal pitches, how many needed >1 attempt (i.e. hit a transient failure)?
const terminal = [...complete, ...failed];
const retried = terminal.filter((p) => (p.attempts ?? 0) >= 2).length;
console.log(`\nTransient-retry rate: ${retried}/${terminal.length} terminal pitches needed >=2 attempts (each retry adds 1-8 min backoff).`);
// what are the failing errors (the retry drivers)?
const errM = {};
for (const p of failed) { const k = /corrupted|invalid_audio/i.test(p.error ?? "") ? "corrupted/empty-audio" : /no audio|no speech|empty/i.test(p.error ?? "") ? "no-audio/no-speech" : /brain|company.*not found/i.test(p.error ?? "") ? "brain/company-config" : /timeout|crash/i.test(p.error ?? "") ? "timeout/crash" : "other"; errM[k] = (errM[k] ?? 0) + 1; }
console.log(`Failed-pitch error classes: ${JSON.stringify(errM)}`);
process.exit(0);
