import { NextRequest, NextResponse } from "next/server";
import { sweepDurabilityChecks } from "@/lib/care/durabilitySweep";

/**
 * POST /api/care/durability-sweep
 *
 * For EXTERNAL cron services (cron-job.org, EasyCron, GitHub Actions,
 * etc.). Auth via shared CARE_DURABILITY_SWEEP_SECRET env header.
 *
 * Vercel Cron consumers use /api/care/durability-sweep-cron instead —
 * it's GET-based and uses Vercel's auto-injected Authorization bearer.
 *
 * Both endpoints invoke the same shared sweep function so the dedup +
 * scan logic stays in one place.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CARE_DURABILITY_SWEEP_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "CARE_DURABILITY_SWEEP_SECRET is not set. Sweep is disabled until an operator configures the shared secret.",
      },
      { status: 503 }
    );
  }
  const provided = req.headers.get("x-care-sweep-secret");
  if (provided !== expected) {
    return NextResponse.json(
      { error: "Sweep authentication failed." },
      { status: 401 }
    );
  }

  try {
    const result = await sweepDurabilityChecks();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sweep failed." },
      { status: 500 }
    );
  }
}
