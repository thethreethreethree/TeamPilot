// One-time cleanup of recordings in storage that nothing points at (docs/STORAGE-ORPHANS-2026-11-21.md; founder
// decision 2026-11-21: delete, dry-run first). Runs the SAME code as the nightly cron — src/lib/storage/
// sweepUnreferencedUploads.ts, loaded through jiti — and the same rule (rss_unreferenced_uploads, 0299). Nothing here
// decides what is a candidate.
//
//   node --env-file=.env.local scripts/sweep-unreferenced-uploads.mjs                 # dry run, 7 days (default)
//   node --env-file=.env.local scripts/sweep-unreferenced-uploads.mjs --apply         # delete, 7 days
//   node --env-file=.env.local scripts/sweep-unreferenced-uploads.mjs --min-age-hours=24
//
// Deletes ONLY with --apply. Each run removes at most 500 (the function's page); run again until candidates = 0.
import { createClient } from "@supabase/supabase-js";
// jiti 1.x arrives with eslint/tailwind (not a direct dependency). If an upgrade changes its API, this import fails
// loudly before anything is listed or removed.
import jitiFactory from "jiti";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const ageArg = args.find((a) => a.startsWith("--min-age-hours="));
const minAgeHours = ageArg ? Number(ageArg.split("=")[1]) : 24 * 7;
if (!Number.isFinite(minAgeHours) || minAgeHours < 1) {
  console.error("--min-age-hours must be a number ≥ 1");
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (run with --env-file=.env.local).");
  process.exit(2);
}

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const { sweepUnreferencedUploads } = jiti("../src/lib/storage/sweepUnreferencedUploads.ts");
const admin = createClient(url, key, { auth: { persistSession: false } });

const r = await sweepUnreferencedUploads(admin, { minAgeHours, dryRun: !apply });
const mb = (b) => (b / 1048576).toFixed(1);
console.log(`${apply ? "APPLY" : "DRY RUN"} · older than ${r.minAgeHours} h`);
console.log(`  candidates: ${r.candidates} files, ${mb(r.candidateBytes)} MB`);
if (apply) console.log(`  removed (confirmed by Storage): ${r.removed} files, ${mb(r.removedBytes)} MB`);
for (const [co, v] of Object.entries(r.byCompany)) console.log(`  company ${co}: ${v.files} files, ${mb(v.bytes)} MB`);
if (r.error) {
  console.error(`  ERROR: ${r.error}`);
  process.exit(1);
}
