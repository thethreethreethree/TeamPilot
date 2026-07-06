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
 * All-company sweep, CAPPED at CRON_CAP dissects per run (§5 — bounds LLM
 * cost + function time; a backlog drains over several daily runs rather than
 * one expensive burst). Steady-state cost is ~zero: it only ever regenerates
 * genuine misses (e.g. a closed tab before /finalize ran).
 */

// Founder-approved 2026-07-01: 12 per daily run, all companies.
const CRON_CAP = 12;

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill sweep failed." },
      { status: 500 }
    );
  }
}
