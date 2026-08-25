#!/usr/bin/env node
// READ-ONLY FORENSIC: for recent Door Log pitches, dump the real storage state — audio_path, parsed recordingId,
// the recording.webm size (from storage LIST metadata, not a download), and the surviving chunk objects
// (count + sizes). Distinguishes a STITCH bug (chunks are fine, recording is tiny) from a CAPTURE bug (chunks
// themselves are tiny/absent). Names the REAL cause of the "invalid_audio/corrupted" failures from data. NO writes.
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
const BUCKET = "assets-v1";

const parseRid = (p) => {
  if (!p) return null;
  const m = /^[^/]+\/doorlog\/([a-zA-Z0-9-]{8,64})\/recording\.webm$/.exec(p);
  return m ? m[1] : null;
};
async function objectSize(dir, name) {
  const { data } = await sb.storage.from(BUCKET).list(dir, { search: name, limit: 100 });
  const e = (data ?? []).find((o) => o.name === name);
  return e ? (e.metadata?.size ?? "?") : "MISSING";
}

const { data, error } = await sb
  .from("pitches")
  .select("id, company_id, audio_path, recorded_at, status, error")
  .gte("recorded_at", "2026-08-24T18:00:00Z")
  .order("recorded_at", { ascending: false })
  .limit(30);
if (error) {
  console.log("query error:", error.message);
  process.exit(1);
}
for (const p of data ?? []) {
  const rid = parseRid(p.audio_path);
  console.log(`\nid=${String(p.id).slice(0, 8)} status=${p.status} rec=${String(p.recorded_at).slice(5, 16)}`);
  console.log(`  audio_path: ${p.audio_path ?? "(none)"}`);
  if (p.error) console.log(`  error: ${String(p.error).replace(/\s+/g, " ").slice(0, 120)}`);
  if (!p.audio_path) continue;
  const lastSlash = p.audio_path.lastIndexOf("/");
  const dir = p.audio_path.slice(0, lastSlash);
  const name = p.audio_path.slice(lastSlash + 1);
  console.log(`  recording size: ${await objectSize(dir, name)} bytes`);
  if (rid) {
    const prefix = `${p.company_id}/doorlog/${rid}/chunks`;
    const { data: chunks } = await sb.storage.from(BUCKET).list(prefix, { limit: 4000 });
    const list = chunks ?? [];
    const total = list.reduce((s, c) => s + (c.metadata?.size ?? 0), 0);
    const names = list.map((c) => c.name).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
    console.log(`  chunks: ${list.length} objects, ${total} bytes total  ${names.slice(0, 8).join(",")}${names.length > 8 ? "…" : ""}`);
  } else {
    console.log(`  (audio_path is NOT a doorlog stitched-recording path — legacy single-blob or other shape)`);
  }
}
process.exit(0);
