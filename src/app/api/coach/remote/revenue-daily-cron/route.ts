import { NextRequest, NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRevenueDaily } from "@/lib/coach/remote/revenue/daily";

/**
 * GET /api/coach/remote/revenue-daily-cron — the nightly revenue job (0382, revenue/daily.ts): each open deal's warnings
 * for the day (drivers over 30 / 90 days read them) and the close-date agents. Registered in vercel.json.
 *
 * Auth: the CRON_SECRET Bearer the sibling crons use (constantTimeEqual). Unset → 503, said plainly, so a missing secret
 * is visible rather than a silent "nothing happened" (§1.5.3). A run that couldn't read which companies to process, or
 * where a company's read failed, is a 500 with the counts, never an "ok".
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not set — the nightly revenue job is disabled until configured." }, { status: 503 });
  }
  if (!constantTimeEqual(req.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });
  }
  try {
    const r = await runRevenueDaily(createAdminClient(), new Date());
    if (r.lookupFailed) return NextResponse.json({ ok: false, error: "Couldn't read which companies to process.", ...r }, { status: 500 });
    if (r.failedCompanies) return NextResponse.json({ ok: false, error: "Some companies failed; they were skipped (see the log).", ...r }, { status: 500 });
    // Out of time: the next slot (vercel.json) continues; after the last slot this still shows, so a monitor sees it.
    if (r.remaining) return NextResponse.json({ ok: false, error: `Ran out of time; ${r.remaining} compan${r.remaining === 1 ? "y is" : "ies are"} left for the next run.`, ...r }, { status: 500 });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("[revenue-daily-cron] failed:", err);
    return NextResponse.json({ error: "The nightly revenue job failed." }, { status: 500 });
  }
}
