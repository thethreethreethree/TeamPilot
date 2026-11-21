import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { sweepUnreferencedUploads } from "@/lib/storage/sweepUnreferencedUploads";

/**
 * GET /api/coach/sales-session/unreferenced-upload-sweep-cron — nightly (vercel.json).
 *
 * Removes recordings in storage that nothing points at and that are over a day old (docs/STORAGE-ORPHANS-2026-11-21.md;
 * founder decision 2026-11-21). They come from sign-then-commit uploads whose commit never arrived: the browser
 * uploads the file, a later request records its path, and a closed tab leaves the file behind. Left alone they are
 * invisible to every screen, to retention, and to §3.1.1 erasure — a customer's voice no erasure can find.
 *
 * WHICH FILES is decided once, in rss_unreferenced_uploads (0299) — this route only calls the sweeper. 24 hours is
 * far beyond any commit (seconds after the upload). Each run is capped (500) and audited per company.
 * `?dryRun=1` lists without removing. Auth: the CRON_SECRET Bearer, as every cron here.
 */
export const maxDuration = 300;
const MIN_AGE_HOURS = 24;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not set — the unreferenced-upload sweep is disabled until configured." }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const report = await sweepUnreferencedUploads(createAdminClient(), { minAgeHours: MIN_AGE_HOURS, dryRun });
  if (report.error) {
    console.error(`[unreferenced-upload-sweep] ${report.error}`);
    // What was removed before the failure is still reported (and audited); the status says the run did not finish.
    return NextResponse.json({ ...report, error: "The sweep did not finish. See the server log." }, { status: 500 });
  }
  return NextResponse.json(report);
}
