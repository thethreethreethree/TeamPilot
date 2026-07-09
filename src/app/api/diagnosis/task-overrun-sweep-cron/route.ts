import { NextRequest, NextResponse } from "next/server";
import { sweepTaskOverruns } from "@/lib/diagnosis/taskOverrunSweep";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * GET /api/diagnosis/task-overrun-sweep-cron
 *
 * Vercel Cron entry point for the task-overrun sweep (emits `task.overran_due_date`
 * → `task_slipped` for overdue-and-open tasks; closure-doc item 9). Mirrors
 * /api/care/durability-sweep-cron exactly.
 *
 * To ACTIVATE (operator step — this is the go-live the founder reserved):
 *   1. Set CRON_SECRET in Vercel env (shared with the durability cron).
 *   2. Add to vercel.json crons, e.g. daily:
 *        { "path": "/api/diagnosis/task-overrun-sweep-cron", "schedule": "0 6 * * *" }
 * Until both are done this route 503s (secret unset) and no schedule invokes it —
 * the code is ready, dormant, and safe.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not set. The task-overrun cron entry point is disabled until you configure it in env.",
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
    const result = await sweepTaskOverruns();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sweep failed." },
      { status: 500 }
    );
  }
}
