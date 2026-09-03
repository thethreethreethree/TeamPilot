import { NextRequest, NextResponse } from "next/server";
import { runWeeklyManagerDigest, runWeeklyRepDigest } from "@/lib/coach/gamification/weeklyDigest";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * GET /api/coach/gamification/weekly-digest-cron — the weekly digests (founder 2026-09-04). For each company with
 * points activity in the last 7 days: emails every manager a TEAM rollup (top performers) AND emails every active
 * rep their OWN progress (points / band / best pitch). Registered in vercel.json (Mon morning). The companion to
 * the live NotificationBell alerts.
 *
 * Auth: the same CRON_SECRET Bearer the sibling coach crons use (constantTimeEqual); a manual browser hit bounces.
 * Fails LOUD if Postmark isn't configured — the result carries emailConfigured:false and a server warn — rather
 * than silently sending nothing (external-config completeness).
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set — the weekly digest cron is disabled until configured." },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });
  }

  try {
    const managers = await runWeeklyManagerDigest();
    const reps = await runWeeklyRepDigest();
    if (!managers.emailConfigured) {
      // eslint-disable-next-line no-console
      console.warn("[gamification/weekly-digest-cron] Postmark not configured (POSTMARK_SERVER_TOKEN / CARE_EMAIL_HOST_DOMAIN) — no email sent.");
    }
    return NextResponse.json({ ok: true, managers, reps });
  } catch (err) {
    console.error("[gamification/weekly-digest-cron] failed:", err);
    return NextResponse.json({ error: "Weekly digest run failed." }, { status: 500 });
  }
}
