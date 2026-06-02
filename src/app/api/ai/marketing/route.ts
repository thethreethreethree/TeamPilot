import { NextResponse } from "next/server";

/**
 * Deprecated. Same reasoning as /api/ai/finance — marketing analysis as a single
 * LLM call asserting a healthScore violates §3.2 / §3.4. Diagnosis runs through
 * the constitutional surfaces once a real data source exists.
 *
 * Closed as part of the 2026-06-02 ground-up audit (Tier 1 #1).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Marketing domain has no production data source yet. Once events exist, diagnosis runs through /dashboard/diagnose.",
    },
    { status: 410 }
  );
}
