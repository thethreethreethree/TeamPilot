import { NextResponse } from "next/server";

/**
 * Deprecated — superseded by the Living Diagnosis runtime (/dashboard/diagnose) and
 * the Problems surface (/dashboard/problems). The old `analyzeOperations` shape
 * returned `healthScore: 0-100` and `diagnosis: "..."` immediately — a §3.2 + §3.3
 * violation (asserts a problem without signals, asserts without asking user first).
 *
 * Closed as part of the 2026-06-02 ground-up audit (Tier 1 #1). See AMD-004.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Operations analysis runs through /dashboard/diagnose (Living Diagnosis) or /dashboard/problems (Understanding Gate). See docs/GUIDE_DONT_OVERTAKE.md.",
    },
    { status: 410 }
  );
}
