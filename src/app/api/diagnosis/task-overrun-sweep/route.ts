import { NextRequest, NextResponse } from "next/server";
import { sweepTaskOverruns } from "@/lib/diagnosis/taskOverrunSweep";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * POST /api/diagnosis/task-overrun-sweep
 *
 * For EXTERNAL cron services (cron-job.org, GitHub Actions, etc.). Auth via a
 * shared TASK_OVERRUN_SWEEP_SECRET env header (x-task-sweep-secret). Vercel Cron
 * consumers use the GET sibling /api/diagnosis/task-overrun-sweep-cron. Both
 * invoke the same sweep so the dedup + scan logic stays in one place.
 *
 * Dormant until an operator sets the secret (503 otherwise) — the founder's
 * go-live call (closure-doc item 9).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.TASK_OVERRUN_SWEEP_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "TASK_OVERRUN_SWEEP_SECRET is not set. Sweep is disabled until an operator configures the shared secret.",
      },
      { status: 503 }
    );
  }
  const provided = req.headers.get("x-task-sweep-secret") ?? "";
  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "Sweep authentication failed." },
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
