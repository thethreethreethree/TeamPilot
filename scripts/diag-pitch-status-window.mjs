#!/usr/bin/env node
// READ-ONLY: watch the re-queued corrupted-audio pitches (recorded 2026-08-24T18:00+) move through the pipeline
// after reset. Polls every ~20s for ~6min, printing each pitch's status so we can see recover (→complete) vs
// re-fail (→failed with error). NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2] || ".";
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

const WINDOW_START = "2026-08-24T18:00:00Z";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let tick = 1; tick <= 18; tick++) {
  const { data, error } = await sb
    .from("pitches")
    .select("id, rep_id, recorded_at, status, attempts, error")
    .gte("recorded_at", WINDOW_START)
    .order("recorded_at", { ascending: false })
    .limit(30);
  if (error) {
    console.log(`tick ${tick}: query error ${error.message}`);
    await sleep(20000);
    continue;
  }
  const rows = data ?? [];
  const dist = {};
  for (const r of rows) dist[r.status] = (dist[r.status] ?? 0) + 1;
  console.log(`\n[tick ${tick}] ${rows.length} pitches in window — ${JSON.stringify(dist)}`);
  for (const r of rows) {
    const err = r.error ? ` err="${String(r.error).replace(/\s+/g, " ").slice(0, 50)}"` : "";
    console.log(`  id=${String(r.id).slice(0, 8)} rec=${String(r.recorded_at).slice(5, 16)} ${String(r.status).padEnd(12)} att=${r.attempts}${err}`);
  }
  const settled = rows.every((r) => r.status === "complete" || r.status === "failed");
  if (settled && tick > 1) {
    console.log(`\nAll settled after ${tick} ticks.`);
    break;
  }
  await sleep(20000);
}
process.exit(0);
