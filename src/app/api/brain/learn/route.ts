import { NextRequest, NextResponse } from "next/server";
import { runLearningCycle } from "@/lib/brain/learn";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";

export async function POST(req: NextRequest) {
  // The learning cycle is LLM-heavy (multiple model calls per run). Without a
  // bound, a member could spam-trigger it and drive cost. The brain page that
  // calls this is member-facing (no admin gate), so gating to admin would break
  // access — rate-limiting hardens the cost surface WITHOUT changing who can use
  // it. Generous per-caller cap: legitimate re-runs are rare; beyond this is abuse.
  const limited = rateLimit(req, {
    id: "brain-learn",
    windowMs: 3_600_000,
    max: 5,
  });
  if (limited) return limited;

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  const result = await runLearningCycle(companyId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
