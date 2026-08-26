import { NextRequest, NextResponse } from "next/server";
import { runTeamBriefPregeneration } from "@/lib/coach/v5/teamTrainingBrief";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * GET /api/coach/sales-session/team-brief-cron — overnight pre-generation of the team training brief (founder
 * 2026-08-27). Registered in vercel.json (early morning, before the workday) so each company's manager opens the
 * Training tab to a brief that's already "ready" instead of waiting on a Build click.
 *
 * Auth: the same CRON_SECRET Bearer the sibling coach crons use (constantTimeEqual); a manual browser hit bounces off
 * the same gate. SEQUENTIAL + capped inside runTeamBriefPregeneration so the LLM burst stays under maxDuration.
 */

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set — the team-brief pre-generation cron is disabled until configured." },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });
  }

  try {
    const result = await runTeamBriefPregeneration();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[coach/team-brief-cron] failed:", err);
    return NextResponse.json({ error: "Team-brief pre-generation failed." }, { status: 500 });
  }
}
