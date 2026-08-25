#!/usr/bin/env node
// Reverse the (mis-diagnosed) re-queue: the 7 "corrupted" pitches are 5-byte EMPTY stubs, not bad concats — the
// recovery can't salvage them, so they just churn retries (wasting STT calls). Reset them to an honest terminal
// 'failed' with the TRUE cause. Targets EXACTLY the pitches I re-queued (company 28203036, status now 'recorded',
// recorded in the failure window, single-blob 5-byte recording). DRY-RUN by default; --apply to mutate.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const root = process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from("pitches")
  .select("id, audio_path, recorded_at, status")
  .eq("company_id", "28203036-6b05-488a-b62d-714033e87cd5")
  .eq("status", "recorded")
  .gte("recorded_at", "2026-08-24T18:00:00Z")
  .lte("recorded_at", "2026-08-25T00:30:00Z");
if (error) { console.log("select error:", error.message); process.exit(1); }
const rows = (data ?? []).filter((r) => !/\/doorlog\//.test(r.audio_path ?? "")); // single-blob 5-byte stubs only
console.log(`\n${APPLY ? "APPLY" : "DRY-RUN"} — ${rows.length} re-queued empty-stub pitch(es) to terminalize honestly:`);
for (const r of rows) console.log(`  id=${String(r.id).slice(0, 8)} rec=${String(r.recorded_at).slice(5, 16)}`);
if (rows.length === 0) { console.log("Nothing to revert."); process.exit(0); }
if (rows.length !== 7) console.log(`\n⚠️  Expected 7; got ${rows.length}. Review before --apply.`);

const ERR = "No audio was captured for this pitch (the recording was empty — a 0-length capture, not a transcription error).";
if (!APPLY) { console.log("\nDRY-RUN only. Re-run with --apply."); process.exit(0); }
const { data: upd, error: uErr } = await sb
  .from("pitches").update({ status: "failed", attempts: 5, error: ERR, run_after: new Date(0).toISOString() })
  .in("id", rows.map((r) => r.id)).eq("status", "recorded").select("id");
if (uErr) { console.log("update error:", uErr.message); process.exit(1); }
console.log(`\nAPPLIED — terminalized ${upd?.length ?? 0} pitch(es) with the honest cause.`);
process.exit(0);
