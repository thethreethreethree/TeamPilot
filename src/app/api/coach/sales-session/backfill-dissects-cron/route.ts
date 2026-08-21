import { NextRequest, NextResponse } from "next/server";
import { runDissectBackfill } from "@/lib/coach/v5/dissectBackfill";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * GET /api/coach/sales-session/backfill-dissects-cron
 *
 * Vercel Cron entry point for the Sales Coach dissect backfill. Configured
 * in vercel.json (daily, off-peak):
 *
 *   { "path": "/api/coach/sales-session/backfill-dissects-cron",
 *     "schedule": "0 4 * * *" }
 *
 * Auth mirrors the durability cron (§A21): Vercel attaches
 * `Authorization: Bearer ${CRON_SECRET}` to scheduled GETs when CRON_SECRET
 * is set. We verify it; manual browser hits bounce off the same gate. The
 * SAME CRON_SECRET the durability cron waits on activates this one too.
 *
 * All-company sweep, CAPPED at CRON_CAP recoveries per run (§5 — bounds LLM
 * cost + function time; a backlog drains over several runs rather than one
 * expensive burst). Runs every 3h (founder 2026-08-21 — accelerate the
 * capture-crisis backlog recovery). Steady-state cost is ~zero: it only ever
 * regenerates genuine misses (e.g. a closed tab before /finalize ran).
 */

// Per-run cap (all companies). Lowered 12→6 (2026-08-21): each recovery now runs the FULL 5-engine artifact
// set (generateSessionArtifacts), not a single dissect, so a batch of N runs 5N concurrent LLM calls — 6 keeps
// the concurrent burst bounded (~30) while a backlog still drains over runs.
const CRON_CAP = 6;

// LLM route: the full 5-engine generation per session (each bounded to 40s) runs the batch concurrently, so
// wall-clock ≈ the slowest engine — but give it the same 300s ceiling /finalize uses, well clear of a timeout.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not set. The dissect-backfill cron is disabled until you configure it in env.",
      },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json(
      { error: "Cron authentication failed." },
      { status: 401 }
    );
  }

  try {
    const result = await runDissectBackfill({ companyId: null, cap: CRON_CAP });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[coach/backfill-dissects-cron] failed:", err);
    return NextResponse.json(
      { error: "Backfill sweep failed." },
      { status: 500 }
    );
  }
}
