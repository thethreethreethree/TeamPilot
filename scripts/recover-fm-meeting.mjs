// RECOVERY (one founder session): stitch the orphaned meeting audio OUT OF BAND — parallel chunk downloads (not
// the doomed 145s sequential the request path does), concat, upload the canonical recording, stamp
// audio_asset_url. Idempotent + scoped to audio_asset_url IS NULL (never clobbers a clean-Stop persist). After
// this, the meeting-dissect route finds the stitched file, skips the stitch, and transcribes IN BUDGET.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "assets-v1";
const company = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7", sid = "d5ed4699-f766-47e4-af7f-2161e5b087a7";
const prefix = `${company}/${sid}/chunks`;
const finalPath = `${company}/${sid}/recording.webm`;

// Guard: never clobber an already-set pointer.
const { data: pre } = await sb.from("coaching_sessions").select("audio_asset_url").eq("id", sid).maybeSingle();
if (pre?.audio_asset_url) { console.log("already has audio:", pre.audio_asset_url); process.exit(0); }

const { data: objects } = await sb.storage.from(BUCKET).list(prefix, { limit: 2000 });
const seqs = (objects ?? []).map((o) => Number(o.name.replace(/\.webm$/i, ""))).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b);
const contiguous = []; let expected = 0;
for (const s of seqs) { if (s === expected) { contiguous.push(s); expected++; } else if (s > expected) break; }
console.log(`stitching ${contiguous.length} contiguous chunks (0..${contiguous[contiguous.length-1]})`);

// Parallel download with bounded concurrency, preserving order.
const t0 = Date.now();
const bufs = new Array(contiguous.length);
const CONC = 24; let next = 0;
async function worker() {
  while (true) {
    const i = next++; if (i >= contiguous.length) return;
    const { data, error } = await sb.storage.from(BUCKET).download(`${prefix}/${contiguous[i]}.webm`);
    if (error || !data) { console.log(`chunk ${contiguous[i]} failed: ${error?.message}`); bufs[i] = null; return; }
    bufs[i] = Buffer.from(await data.arrayBuffer());
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
// Concat up to the first unreadable chunk (keep the valid head), mirroring the real stitch's tail-truncation.
const parts = []; let dropped = 0;
for (let i = 0; i < bufs.length; i++) {
  if (!bufs[i]) break;
  parts.push(bufs[i]);
}
const merged = Buffer.concat(parts);
console.log(`downloaded ${parts.length} chunks in ${((Date.now()-t0)/1000).toFixed(1)}s (parallel) → ${(merged.length/1024/1024).toFixed(2)} MB, dropped ${dropped}`);

const { error: upErr } = await sb.storage.from(BUCKET).upload(finalPath, merged, { contentType: "audio/webm", upsert: true });
if (upErr) { console.error("upload failed:", upErr.message); process.exit(1); }
const { data: stamped, error: updErr } = await sb.from("coaching_sessions")
  .update({ audio_asset_url: `${BUCKET}/${finalPath}` }).eq("id", sid).is("audio_asset_url", null).select("id");
if (updErr) { console.error("stamp failed:", updErr.message); process.exit(1); }
console.log(stamped?.length ? `STAMPED audio_asset_url = ${BUCKET}/${finalPath}` : "raced — audio set concurrently");
console.log("Recovery done. The meeting review can now transcribe the stitched file in-budget (no re-stitch).");
process.exit(0);
