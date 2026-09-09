import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * Manager sets a rep's DAILY SALES GOAL (door home screen, Q1: manager sets it per rep). Backs the door target.
 *
 * GET  ?repId=<uuid> → { salesGoal: number|null } — the rep reads their own; a same-company manager reads a rep's
 *   (RLS on rep_daily_sales_goal enforces it).
 * PATCH { repId, salesGoal } → MANAGER only (a rep can't set their own goal). Caller-scoped (Bearer-safe for the
 *   mobile app) so RLS applies for THIS user; the route-level manager gate gives a clean 403.
 *
 * Migration-coupling (A34): rep_daily_sales_goal lands in 0247; until it applies, degrade to a clear message.
 */

const Body = z.object({
  repId: z.string().uuid(),
  salesGoal: z.number().int().positive(),
});

export async function GET(req: NextRequest) {
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const repId = new URL(req.url).searchParams.get("repId") ?? auth.user.id;
  const { data, error } = await sb
    .from("rep_daily_sales_goal")
    .select("sales_goal")
    .eq("rep_id", repId)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, "sales_goal") || /rep_daily_sales_goal/.test(error.message ?? "")) {
      return NextResponse.json({ salesGoal: null, unavailable: true });
    }
    console.error("[doorlog/rep-goal GET] read failed:", error.message);
    return NextResponse.json({ error: "Couldn't read the goal." }, { status: 500 });
  }
  return NextResponse.json({ salesGoal: (data?.sales_goal as number | null) ?? null });
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: me } = await sb.from("profiles").select("role, sales_coach_role, company_id").eq("id", auth.user.id).maybeSingle();
  if (!isSalesCoachManager({
    role: (me?.role as string | null) ?? null,
    sales_coach_role: (me?.sales_coach_role as string | null) ?? null,
    company_id: (me?.company_id as string | null) ?? null,
  })) {
    return NextResponse.json({ error: "Only a manager can set a rep's daily goal." }, { status: 403 });
  }
  const companyId = (me?.company_id as string | null) ?? null;
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  // Upsert the rep's standing goal. company_id is pinned to the manager's own company (RLS also checks this).
  const { error } = await sb
    .from("rep_daily_sales_goal")
    .upsert(
      { rep_id: body.repId, company_id: companyId, sales_goal: body.salesGoal, set_by: auth.user.id, updated_at: new Date().toISOString() },
      { onConflict: "rep_id" },
    );
  if (error) {
    if (isMissingColumnError(error, "sales_goal") || /rep_daily_sales_goal/.test(error.message ?? "")) {
      return NextResponse.json({ error: "Daily goals aren't available yet — the update is still rolling out." }, { status: 503 });
    }
    console.error("[doorlog/rep-goal PATCH] write failed:", error.message);
    return NextResponse.json({ error: "Couldn't save the goal." }, { status: 500 });
  }
  return NextResponse.json({ salesGoal: body.salesGoal });
}
