import { NextRequest, NextResponse } from "next/server";
import { unlockControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

/**
 * Manually unlock the §3.4 Month-1 control window for this company. The reason
 * is required and is recorded in brain_evolution_events for §7.5 review.
 */
export async function POST(req: NextRequest) {
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  const { reason } = await req.json().catch(() => ({}));
  if (typeof reason !== "string" || reason.trim().length < 20) {
    return NextResponse.json(
      {
        error:
          "A reason of ≥20 chars is required. Unlocking the control window before day 30 is an explicit override of §3.4; the reason is preserved so future review can assess whether early unlock helped or hurt outcomes.",
      },
      { status: 400 }
    );
  }
  try {
    await unlockControlGate({ companyId, reason });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
