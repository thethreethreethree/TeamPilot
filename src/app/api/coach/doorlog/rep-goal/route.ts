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
  // Dollar value per sale, in CENTS (0248) — powers the door screen's cash box. Optional + nullable: a manager
  // can set the goal without a per-sale value (the screen then shows sales-to-goal instead of dollars).
  saleValueCents: z.number().int().nonnegative().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const repId = new URL(req.url).searchParams.get("repId") ?? auth.user.id;
  // select("*") not a named projection so a pre-0248 DB (no sale_value_cents) doesn't error (A34).
  const { data, error } = await sb
    .from("rep_daily_sales_goal")
    .select("*")
    .eq("rep_id", repId)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, "sales_goal") || /rep_daily_sales_goal/.test(error.message ?? "")) {
      return NextResponse.json({ salesGoal: null, saleValueCents: null, unavailable: true });
    }
    console.error("[doorlog/rep-goal GET] read failed:", error.message);
    return NextResponse.json({ error: "Couldn't read the goal." }, { status: 500 });
  }
  return NextResponse.json({
    salesGoal: (data?.sales_goal as number | null) ?? null,
    saleValueCents: (data?.sale_value_cents as number | null | undefined) ?? null,
  });
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
  const base = {
    rep_id: body.repId,
    company_id: companyId,
    sales_goal: body.salesGoal,
    set_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  const withValue =
    body.saleValueCents === undefined ? base : { ...base, sale_value_cents: body.saleValueCents };

  let { error } = await sb.from("rep_daily_sales_goal").upsert(withValue, { onConflict: "rep_id" });
  // A34: if sale_value_cents isn't in the DB yet (0248 not applied), still save the goal without it rather than
  // failing the whole write — the $-per-sale simply can't be stored until the migration lands.
  let saleValueSaved = body.saleValueCents !== undefined;
  if (error && isMissingColumnError(error, "sale_value_cents") && body.saleValueCents !== undefined) {
    ({ error } = await sb.from("rep_daily_sales_goal").upsert(base, { onConflict: "rep_id" }));
    saleValueSaved = false;
  }
  if (error) {
    if (isMissingColumnError(error, "sales_goal") || /rep_daily_sales_goal/.test(error.message ?? "")) {
      return NextResponse.json({ error: "Daily goals aren't available yet — the update is still rolling out." }, { status: 503 });
    }
    console.error("[doorlog/rep-goal PATCH] write failed:", error.message);
    return NextResponse.json({ error: "Couldn't save the goal." }, { status: 500 });
  }
  return NextResponse.json({
    salesGoal: body.salesGoal,
    saleValueCents: saleValueSaved ? body.saleValueCents ?? null : null,
  });
}
