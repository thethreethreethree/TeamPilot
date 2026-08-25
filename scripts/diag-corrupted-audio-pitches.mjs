#!/usr/bin/env node
// READ-ONLY: how many Door Log pitches terminally FAILED with an audio-corruption error (ElevenLabs
// "invalid_audio / File is corrupted")? These are the candidates the bad-concat recovery (b5cdb61d) can salvage
// on a re-queue: the bad-concat subset recovers by transcribing the first segment; genuinely-corrupt/empty ones
// re-fail honestly (one STT call each). This count informs the founder's re-queue cost decision. NO writes.
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

async function countFailed(pattern) {
  const { count, error } = await sb
    .from("pitches")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .ilike("error", pattern);
  if (error) throw new Error(`${pattern}: ${error.message}`);
  return count ?? 0;
}

const { count: totalFailed } = await sb.from("pitches").select("*", { count: "exact", head: true }).eq("status", "failed");
const corrupted = await countFailed("%corrupted%");
const invalidAudio = await countFailed("%invalid_audio%");
console.log(`\nTerminal 'failed' pitches:            ${totalFailed ?? 0}`);
console.log(`  …error contains "corrupted":        ${corrupted}   ← re-queue candidates (recovery can salvage the bad-concat subset)`);
console.log(`  …error contains "invalid_audio":    ${invalidAudio}`);

// Bounded sample (never rely on an unbounded select — it silently caps at 1000). Break down by rep + fingerprint.
const { data, error } = await sb
  .from("pitches")
  .select("id, company_id, rep_id, recorded_at, attempts, error")
  .eq("status", "failed")
  .ilike("error", "%corrupted%")
  .order("recorded_at", { ascending: false })
  .limit(200);
if (error) {
  console.log("sample error:", error.message);
  process.exit(1);
}
const rows = data ?? [];
const withFingerprint = rows.filter((r) => /bad-concat|secondInit/i.test(r.error ?? "")).length; // only POST-fix failures carry this
const byRep = {};
for (const r of rows) byRep[r.rep_id] = (byRep[r.rep_id] ?? 0) + 1;
console.log(
  `\nSample (latest ${rows.length}): ${withFingerprint} carry a post-fix bad-concat fingerprint; ${Object.keys(byRep).length} distinct rep(s).`
);
for (const r of rows.slice(0, 15)) {
  console.log(
    `  ${String(r.recorded_at ?? "?").slice(0, 16)}  rep=${String(r.rep_id).slice(0, 8)}  att=${r.attempts}  ${String(r.error ?? "").replace(/\s+/g, " ").slice(0, 90)}`
  );
}
