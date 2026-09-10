import { NextRequest, NextResponse } from "next/server";
import { runTranscriptRecoverySweep } from "@/lib/coach/v5/transcriptRecoverySweep";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * GET /api/coach/sales-session/recover-transcripts-cron
 *
 * The unattended half of transcript recovery. Configured in vercel.json:
 *
 *   { "path": "/api/coach/sales-session/recover-transcripts-cron",
 *     "schedule": "20 * * * *" }
 *
 * WHY IT EXISTS. On 10 September 2026 production held nine sessions with saved audio and
 * no transcript at all — one of them the founder's 149-second test from that morning, the
 * oldest from 25 July. Every one had `auto_recover_attempted_at = null`: nothing had ever
 * tried. A rep does not go back to a call that showed them nothing, so an on-open trigger
 * alone would have left all nine exactly where they were. This is the trigger that reaches
 * the calls nobody reopens.
 *
 * Auth mirrors the durability and dissect-backfill crons (§A21): Vercel attaches
 * `Authorization: Bearer ${CRON_SECRET}` to scheduled GETs, verified in constant time, so
 * a manual browser hit bounces off the same gate.
 *
 * All-company sweep, CAPPED at CRON_CAP recoveries per run (§5 — each recovery is one
 * speech-to-text charge, so a backlog drains over several hours rather than one
 * unplanned bill). Steady state is ~zero work: with the upload path now saving a
 * transcript unconditionally, a genuine miss should be rare, and the sweep is the net
 * under it rather than the mechanism it depends on.
 */

// Per-run cap across all companies. Each attempt is one batch diarization of a full
// recording; six per hour drains the nine-session backlog inside two runs while keeping
// any single run's cost and wall-clock bounded.
const CRON_CAP = 6;

// Batch diarization of multi-minute recordings, up to CRON_CAP of them sequentially — the
// same 300s ceiling /auto-recover and the dissect backfill use.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not set. Transcript recovery sweeps are disabled until you configure it in env.",
      },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });
  }

  try {
    const result = await runTranscriptRecoverySweep({ companyId: null, cap: CRON_CAP });
    return NextResponse.json(result);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[coach/recover-transcripts-cron] failed:", err);
    return NextResponse.json({ error: "Transcript recovery sweep failed." }, { status: 500 });
  }
}
