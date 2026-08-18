import { NextRequest, NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { processDuePitches } from "@/lib/coach/doorlog/worker";

/**
 * GET /api/coach/sales-session/pitch-processing-cron
 *
 * Vercel Cron entry point for the Macro Mode pitch pipeline (build-spec 3.3). Configured in vercel.json
 * (every minute). This is what makes processing DURABLE — the fire-and-forget kick after enqueue is only a
 * latency optimisation; this sweep picks up anything queued or retry-eligible.
 *
 * Auth mirrors the other crons (A21): Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled
 * GETs; we verify it constant-time. Unset secret → 503 (disabled, fails LOUD). The SAME CRON_SECRET the
 * other crons use activates this one.
 */

// LLM + STT route: needs a long serverless budget (transcription + analysis run via lib chains). 300s = Pro max.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set. The pitch-processing cron is disabled until it is configured." },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });
  }

  // Bounded per run (LLM/STT cost + function time). A backlog drains across successive minute runs.
  const processed = await processDuePitches(10);
  return NextResponse.json({ processed });
}
