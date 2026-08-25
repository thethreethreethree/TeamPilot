#!/usr/bin/env node
// READ-ONLY GROUND TRUTH: download the actual stored recordings of the re-queued corrupted-audio pitches and
// inspect their bytes — size, container magic (webm EBML / mp4 ftyp / other), and whether a SECOND init header
// sits mid-file (the bad-concat fingerprint the mp4-reseam prevents). This CONFIRMS the "invalid_audio/corrupted"
// diagnosis from the real files (the mp4-reseam TBC flagged this as unreachable headlessly at fix time). NO writes.
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
const ASSETS_BUCKET = "assets-v1";

// Mirror src/lib/coach/v5/stitchSessionAudio.ts (kept identical on purpose).
const startsWithEbml = (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
const startsWithFtyp = (b) => b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
function findSecondInit(b) {
  const ebml = b.indexOf(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 1);
  if (ebml >= 0) return ebml;
  return b.indexOf(Buffer.from([0x66, 0x74, 0x79, 0x70]), 8);
}

const { data, error } = await sb
  .from("pitches")
  .select("id, audio_path, recorded_at, status")
  .gte("recorded_at", "2026-08-24T18:00:00Z")
  .order("recorded_at", { ascending: false })
  .limit(30);
if (error) {
  console.log("query error:", error.message);
  process.exit(1);
}
const rows = data ?? [];
console.log(`\nInspecting ${rows.length} recent pitch recording(s):\n`);
let badConcats = 0;
for (const r of rows) {
  if (!r.audio_path) {
    console.log(`  id=${String(r.id).slice(0, 8)} status=${r.status} — NO audio_path`);
    continue;
  }
  const { data: blob, error: dErr } = await sb.storage.from(ASSETS_BUCKET).download(r.audio_path);
  if (dErr || !blob) {
    console.log(`  id=${String(r.id).slice(0, 8)} status=${r.status} — download failed: ${dErr?.message ?? "no data"}`);
    continue;
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  const container = startsWithEbml(buf) ? "webm" : startsWithFtyp(buf) ? "mp4" : "other";
  const second = findSecondInit(buf);
  const bad = second > 0;
  if (bad) badConcats++;
  console.log(
    `  id=${String(r.id).slice(0, 8)} ${String(r.status).padEnd(11)} ${container.padEnd(5)} size=${String(buf.length).padStart(8)} head=${buf.subarray(0, 12).toString("hex")}` +
      (bad ? `  ← BAD-CONCAT: 2nd init @${second}` : "  (single segment)")
  );
}
console.log(`\n${badConcats} of ${rows.length} are bad concats (a mid-file second init segment).`);
process.exit(0);
