import { NextResponse } from "next/server";

/**
 * Deprecated. Finance analysis as a single LLM call returning a "healthScore" is the
 * §3.2 / §3.4 failure mode. Finance signals must enter the chain through the events
 * layer (manual entry today, accounting integrations later); diagnosis runs through
 * /dashboard/diagnose like any other domain.
 *
 * Closed as part of the 2026-06-02 ground-up audit (Tier 1 #1).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Finance domain has no production data source yet (see /dashboard/finance design preview). Once events exist, diagnosis runs through /dashboard/diagnose.",
    },
    { status: 410 }
  );
}
