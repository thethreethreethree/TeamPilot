// Recover EVERY orphaned session recording: audio_asset_url IS NULL but live audio chunks are still in storage
// (the stitch failed — size cap and/or the 145s sequential-download timeout). Stitches each with PARALLEL chunk
// downloads and stamps audio_asset_url, so the review can transcribe. Dry-run by default; pass --apply to write.
//   node scripts/backfill-orphaned-recordings.mjs [--apply]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "assets-v1";

// Candidate sessions: no stitched recording yet. (Newest first; cap the scan.)
const { data: sessions } = await sb.from("coaching_sessions")
  .select("id, company_id, session_kind, client_label, status, started_at")
  .is("audio_asset_url", null)
  .order("started_at", { ascending: false }).limit(500);

let orphans = 0, recovered = 0, failed = 0;
for (const s of sessions ?? []) {
  const prefix = `${s.company_id}/${s.id}/chunks`;
  const { data: objects } = await sb.storage.from(BUCKET).list(prefix, { limit: 2000 });
  if (!objects || objects.length === 0) continue; // no chunks → genuinely never recorded, skip
  orphans++;
  const seqs = objects.map((o) => Number(o.name.replace(/\.webm$/i, ""))).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b);
  const contiguous = []; let expected = 0;
  for (const q of seqs) { if (q === expected) { contiguous.push(q); expected++; } else if (q > expected) break; }
  const label = `${s.session_kind} "${s.client_label ?? "?"}" ${s.id.slice(0, 8)} (${contiguous.length} chunks)`;
  if (!APPLY) { console.log(`[dry] would recover ${label}`); continue; }

  // Parallel download → concat contiguous head → upload → stamp (mirrors stitchSessionAudio, out-of-band).
  const bufs = new Array(contiguous.length); let cursor = 0;
  await Promise.all(Array.from({ length: 24 }, async () => {
    for (let i = cursor++; i < contiguous.length; i = cursor++) {
      const { data } = await sb.storage.from(BUCKET).download(`${prefix}/${contiguous[i]}.webm`);
      bufs[i] = data ? Buffer.from(await data.arrayBuffer()) : null;
    }
  }));
  const parts = []; for (const b of bufs) { if (!b) break; parts.push(b); }
  const merged = Buffer.concat(parts);
  const fpath = `${s.company_id}/${s.id}/recording.webm`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(fpath, merged, { contentType: "audio/webm", upsert: true });
  if (upErr) { console.log(`  ✗ ${label}: upload ${upErr.message}`); failed++; continue; }
  const { data: stamped, error: updErr } = await sb.from("coaching_sessions")
    .update({ audio_asset_url: `${BUCKET}/${fpath}` }).eq("id", s.id).is("audio_asset_url", null).select("id");
  if (updErr) { console.log(`  ✗ ${label}: stamp ${updErr.message}`); failed++; continue; }
  console.log(`  ✓ recovered ${label} → ${(merged.length/1024/1024).toFixed(1)} MB`);
  recovered++;
}
console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"}: ${orphans} orphaned session(s) with chunks; recovered ${recovered}, failed ${failed}.`);
process.exit(0);
