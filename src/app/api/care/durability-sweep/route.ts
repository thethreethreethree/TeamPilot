import { NextRequest, NextResponse } from "next/server";
import { sweepDurabilityChecks } from "@/lib/care/durabilitySweep";
import { constantTimeEqual } from "@/lib/api/constantTime";

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
  // Constant-time compare — a plain !== short-circuits on the first differing byte,
  // leaking the secret to a timing side-channel. Matches the -cron sibling and every
  // other secret check in the codebase (which all use constantTimeEqual).
  const provided = req.headers.get("x-care-sweep-secret") ?? "";
  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "Sweep authentication failed." },
      { status: 401 }
    );
  }

  try {
    const result = await sweepDurabilityChecks();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[care/durability-sweep] failed:", err);
    return NextResponse.json(
      { error: "Sweep failed." },
      { status: 500 }
    );
  }
}
