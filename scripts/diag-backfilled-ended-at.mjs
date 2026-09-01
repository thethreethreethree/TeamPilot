#!/usr/bin/env node
// READ-ONLY: preview EXACTLY the rows migration 0240 will touch — sessions whose wall-clock span is implausibly
// long (>4h, matching the code cap) AND carry no real audio length. Confirms the target before we null ended_at.
// Also prints a distribution of ended_at values so we can see the 2026-08-21 backfill cluster. NO writes.
//   node scripts/diag-backfilled-ended-at.mjs   (pass repo root as $1 if not cwd-run)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2] || ".";
const env = Object.fromEntries(readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const FOUR_H = 4 * 3600;
// Pull every ended session's timing fields; classify in JS (mirrors the migration's WHERE exactly).
const rows = [];
let from = 0;
for (;;) {
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("id, company_id, agent_id, started_at, ended_at, audio_duration_seconds, status")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true })
    .range(from, from + 999);
  if (error) { console.error(error); process.exit(1); }
  rows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
  from += 1000;
}

const spanSec = (r) => (new Date(r.ended_at) - new Date(r.started_at)) / 1000;
const target = rows.filter((r) => (r.audio_duration_seconds == null) && spanSec(r) > FOUR_H);

console.log(`\ntotal ended sessions scanned: ${rows.length}`);
console.log(`MIGRATION 0240 TARGET (no audio AND span > 4h): ${target.length}`);

// ended_at cluster distribution among the target set
const byEnded = new Map();
for (const r of target) { const k = r.ended_at; byEnded.set(k, (byEnded.get(k) ?? 0) + 1); }
console.log(`\nended_at clusters in target set (top 8):`);
[...byEnded.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([ts, n]) => console.log(`  ${n.toString().padStart(4)}  ${ts}`));

// span extremes to sanity-check (max should be the ~54-day poison; min just over 4h)
const spans = target.map(spanSec).sort((a, b) => a - b);
if (spans.length) {
  const days = (s) => (s / 86400).toFixed(1);
  console.log(`\nspan range in target: min ${days(spans[0])}d  max ${days(spans[spans.length - 1])}d`);
}

// SAFETY: confirm we never touch a session with real audio (should be 0 by construction)
const withAudio = rows.filter((r) => r.audio_duration_seconds != null && spanSec(r) > FOUR_H);
console.log(`\nsessions with real audio AND span>4h (NOT touched, expect small/0): ${withAudio.length}`);
