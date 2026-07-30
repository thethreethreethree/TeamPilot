import { NextResponse } from "next/server";
import { loadBrain, loadControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  try {
    const [brain, gate] = await Promise.all([
      loadBrain(companyId),
      loadControlGate(companyId),
    ]);

    // Pull the brain evolution audit trail for §3.6 visibility.
    const supabase = await createClient();
    const { data: events } = await supabase
      .from("brain_evolution_events")
      .select(
        "id, kind, claim, reasoning, confidence, source_event_ids, source_resolution_ids, brain_version_before, brain_version_after, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      brain,
      gate,
      evolution: (events ?? []).map((e) => ({
        id: e.id,
        kind: e.kind,
        claim: e.claim,
        reasoning: e.reasoning,
        confidence: e.confidence,
        sourceEventIds: e.source_event_ids ?? [],
        sourceResolutionIds: e.source_resolution_ids ?? [],
        brainVersionBefore: e.brain_version_before,
        brainVersionAfter: e.brain_version_after,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    console.error("[brain] request failed:", err);
    return NextResponse.json(
      { error: "Couldn't process the request." },
      { status: 500 }
    );
  }
}
