import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * GET  /api/coach/sales-session/quota — the company's monthly deals-won target (for the KPI Quota metric).
 * PATCH /api/coach/sales-session/quota — { target: number|null } — MANAGER only (company-scoped).
 *
 * Founder-confirmed 2026-07-30: quota is a monthly deals-won target per rep, company-wide. A34-guarded: if
 * migration 0206 isn't applied, GET returns null (metric stays "building") and PATCH returns a soft 409.
 */

const PatchSchema = z.object({ target: z.number().int().positive().max(100000).nullable() }).strict();

export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("companies")
    .select("sales_coach_monthly_deal_target")
    .eq("id", ctx.companyId)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, "sales_coach_monthly_deal_target")) {
      return NextResponse.json({ target: null, degraded: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ target: (data?.sales_coach_monthly_deal_target as number | null) ?? null });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Manager gate (a rep can't set the team's quota).
  const { data: me } = await sb
    .from("profiles")
    .select("role, sales_coach_role, company_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (
    !isSalesCoachManager({
      role: (me?.role as string | null) ?? null,
      sales_coach_role: (me?.sales_coach_role as string | null) ?? null,
      company_id: (me?.company_id as string | null) ?? null,
    })
  ) {
    return NextResponse.json({ error: "Only a manager can set the quota target." }, { status: 403 });
  }

  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const { error } = await sb
    .from("companies")
    .update({ sales_coach_monthly_deal_target: body.target })
    .eq("id", ctx.companyId);
  if (error) {
    if (isMissingColumnError(error, "sales_coach_monthly_deal_target")) {
      return NextResponse.json(
        { error: "Quota target isn't available yet (migration 0206 pending)." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, target: body.target });
}
