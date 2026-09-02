// READ-ONLY diagnosis of the founder's orphaned meeting audio: download every chunk, time it, and analyze why
// the on-demand stitch fails to produce a usable recording. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "assets-v1";
const company = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7", sid = "d5ed4699-f766-47e4-af7f-2161e5b087a7";
const prefix = `${company}/${sid}/chunks`;

const { data: objects } = await sb.storage.from(BUCKET).list(prefix, { limit: 2000 });
// contiguous run from 0 (mirrors orderedChunkSeqs)
const seqs = (objects ?? []).map((o) => Number(o.name.replace(/\.webm$/i, ""))).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b);
const contiguous = []; let expected = 0;
for (const s of seqs) { if (s === expected) { contiguous.push(s); expected++; } else if (s > expected) break; }
console.log(`objects=${objects?.length} parsed-seqs=${seqs.length} contiguous-from-0=${contiguous.length} (max seq ${seqs[seqs.length-1]})`);
const missing = []; for (let i = 0; i <= seqs[seqs.length-1]; i++) if (!seqs.includes(i)) missing.push(i);
console.log(`missing seqs in 0..${seqs[seqs.length-1]}: ${missing.length ? missing.slice(0,20).join(",") : "none"}`);

const isEbml = (b) => b.length >= 4 && b[0]===0x1a && b[1]===0x45 && b[2]===0xdf && b[3]===0xa3;
const isMp4 = (b) => b.length >= 8 && b[4]===0x66 && b[5]===0x74 && b[6]===0x79 && b[7]===0x70;

const t0 = Date.now();
const parts = []; const tiny = []; let secondHeaderAt = -1; let firstFmt = "?";
for (let i = 0; i < contiguous.length; i++) {
  const path = `${prefix}/${contiguous[i]}.webm`;
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) { console.log(`  chunk ${contiguous[i]}: DOWNLOAD FAILED ${error?.message}`); break; }
  const buf = Buffer.from(await data.arrayBuffer());
  if (i === 0) firstFmt = isEbml(buf) ? "webm/EBML" : isMp4(buf) ? "mp4/ftyp" : `UNKNOWN head=${buf.subarray(0,8).toString("hex")}`;
  if (buf.length < 100) tiny.push({ seq: contiguous[i], size: buf.length });
  if (i > 0 && (isEbml(buf) || isMp4(buf)) && secondHeaderAt < 0) secondHeaderAt = contiguous[i];
  parts.push(buf);
}
const dlMs = Date.now() - t0;
const merged = Buffer.concat(parts);
console.log(`\nDOWNLOAD: ${parts.length} chunks in ${(dlMs/1000).toFixed(1)}s  → merged ${merged.length} bytes (${(merged.length/1024/1024).toFixed(2)} MB)`);
console.log(`first-chunk format: ${firstFmt}`);
console.log(`tiny chunks (<100B, likely failed uploads): ${tiny.length ? JSON.stringify(tiny) : "none"}`);
console.log(`second recording header (recorder-recreated) at seq: ${secondHeaderAt < 0 ? "none — one continuous recording" : secondHeaderAt}`);
// If the real stitch would keep only up to the second header:
if (secondHeaderAt > 0) {
  const idx = contiguous.indexOf(secondHeaderAt);
  const headBytes = Buffer.concat(parts.slice(0, idx)).length;
  console.log(`  → real stitch keeps seqs 0..${secondHeaderAt-1} = ${headBytes} bytes (${(headBytes/1024/1024).toFixed(2)} MB) before the seam`);
}
console.log(`\nDIAGNOSIS: audio present & downloadable. Time to download all chunks = ${(dlMs/1000).toFixed(1)}s (the serverless stitch does this SEQUENTIALLY inside one request).`);
process.exit(0);
