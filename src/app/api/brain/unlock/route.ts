import { NextRequest, NextResponse } from "next/server";
import { unlockControlGate } from "@/lib/brain";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";

/**
 * Manually unlock the §3.4 Month-1 control window for this company. The reason
 * is required and is recorded in brain_evolution_events for §7.5 review.
 *
 * Per TT.md A21 audit (2026-06-18) CRITICAL finding C1 — until this fix any
 * authenticated company member could call this endpoint and override the
 * §3.4 control window. That meant a non-leadership user could unilaterally
 * disable the constitutional discipline that makes the System trustworthy.
 *
 * Defense: requireCompanyAdmin via getCurrentAuthContext — the unlock is
 * gated to CEO / COO / admin only. The 20-char reason requirement remains
 * (it goes into brain_evolution_events for §7.5 retrospective review).
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  if (!ctx.isAdmin) {
    return NextResponse.json(
      {
        error:
          "Only company leadership (CEO / COO / admin) can unlock the §3.4 control window. The unlock is an explicit constitutional override; it requires leadership authority.",
      },
      { status: 403 }
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
    await unlockControlGate({ companyId: ctx.companyId, reason });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[brain/unlock] failed:", err);
    return NextResponse.json(
      { error: "Couldn't unlock the control gate." },
      { status: 500 }
    );
  }
}
