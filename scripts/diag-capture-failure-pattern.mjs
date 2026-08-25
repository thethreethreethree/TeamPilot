#!/usr/bin/env node
// READ-ONLY: characterise the EMPTY-CAPTURE problem from data (NOT assumption). Three questions:
//  (1) What do the client capture_failed events across the WHOLE platform show — the cause distribution
//      (trackEnded / trackMuted / wakeLock-not-granted / recorderError / chunksUploaded) + UA families?
//  (2) For the company whose pitches were 5-byte stubs: per-rep pitch OUTCOME mix (complete vs corrupted vs
//      no-audio) — is the empty capture INTERMITTENT (device state) or PERSISTENT (that rep always fails)?
//  (3) Do the affected pitches ever ride the chunked path, or ONLY the single-blob fallback? NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CO = "28203036-6b05-488a-b62d-714033e87cd5";
const uaFamily = (ua) => !ua ? "?" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "other";

// (1) platform-wide capture_failed events
const { data: evs } = await sb.from("events").select("created_at, company_id, payload").eq("kind", "doorlog.capture_failed").gte("created_at", "2026-08-11T00:00:00Z").order("created_at", { ascending: false }).limit(500);
console.log(`\n(1) doorlog.capture_failed events (last 14d, all companies): ${evs?.length ?? 0}`);
if (evs?.length) {
  const tally = (f) => { const m = {}; for (const e of evs) { const v = String(e.payload?.[f]); m[v] = (m[v] ?? 0) + 1; } return m; };
  console.log(`    trackEnded: ${JSON.stringify(tally("trackEnded"))}`);
  console.log(`    trackMuted: ${JSON.stringify(tally("trackMuted"))}`);
  console.log(`    wakeLockGranted: ${JSON.stringify(tally("wakeLockGranted"))}`);
  console.log(`    sawData: ${JSON.stringify(tally("sawData"))}`);
  console.log(`    chunksUploaded=0: ${evs.filter((e) => (e.payload?.chunksUploaded ?? 0) === 0).length}/${evs.length}`);
  console.log(`    recorderError set: ${evs.filter((e) => e.payload?.recorderError).length}`);
  const uaM = {}; for (const e of evs) { const k = uaFamily(e.payload?.ua); uaM[k] = (uaM[k] ?? 0) + 1; }
  console.log(`    UA family: ${JSON.stringify(uaM)}`);
}

// (2)+(3) the affected company's pitch outcomes per rep + path
const { data: pitches } = await sb.from("pitches").select("rep_id, status, error, audio_path, recorded_at").eq("company_id", CO).gte("recorded_at", "2026-08-01T00:00:00Z").order("recorded_at", { ascending: false }).limit(500);
console.log(`\n(2) company ${CO.slice(0, 8)} pitch outcomes since 08-01: ${pitches?.length ?? 0} pitches`);
const byRep = {};
for (const p of pitches ?? []) {
  const path = /\/doorlog\//.test(p.audio_path ?? "") ? "chunked" : p.audio_path ? "single-blob" : "no-path";
  const cls = p.status === "complete" ? "complete" : p.status !== "failed" ? p.status : /corrupted|invalid_audio/i.test(p.error ?? "") ? "FAIL:corrupted" : /no audio|empty|no speech/i.test(p.error ?? "") ? "FAIL:no-audio" : "FAIL:other";
  const r = (byRep[p.rep_id] ??= { total: 0, cls: {}, path: {} });
  r.total++; r.cls[cls] = (r.cls[cls] ?? 0) + 1; r.path[path] = (r.path[path] ?? 0) + 1;
}
for (const [rep, r] of Object.entries(byRep)) {
  console.log(`  rep ${rep.slice(0, 8)}: ${r.total} pitches  outcomes=${JSON.stringify(r.cls)}  paths=${JSON.stringify(r.path)}`);
}
process.exit(0);
