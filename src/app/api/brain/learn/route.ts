import { NextRequest, NextResponse } from "next/server";
import { runLearningCycle } from "@/lib/brain/learn";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";

// The learning cycle runs a distillation LLM call over a full JSON evidence payload
// (gatherEvidence → llmCall), which routinely exceeds Vercel's ~10s default function
// timeout — so in prod this route would 504 mid-run without a bound, exactly when a
// company has enough accumulated data for learning to matter. 60 matches every other
// LLM route in this app (the account's proven-safe ceiling). This was the one LLM-
// reaching route missing the bound.
export const maxDuration = 60;

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
