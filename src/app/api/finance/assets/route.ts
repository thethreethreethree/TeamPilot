import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * Fixed assets (migration 0166).
 *
 * GET  /api/finance/assets — the register: cost, accumulated depreciation, net book value, and how much
 *                            depreciable base is left.
 * POST /api/finance/assets — register an asset · run depreciation · dispose.
 *
 * WHY `remaining_depreciable` IS RETURNED AND NOT JUST NBV
 * Net book value alone hides the thing that actually matters at the end of an asset's life. An asset with
 * NBV 1,000 might have 0 depreciable base left (it has reached salvage and must STOP) or 900 left (it has
 * years to run). Those two are indistinguishable from NBV, and the difference decides whether the next
 * depreciation run is correct or produces a false asset valuation. So both are surfaced.
 *
 * The route re-implements NONE of the arithmetic. The salvage clamp and the (asset, period) idempotency
 * live in the DEFINER RPC, where a direct PostgREST call cannot route around them — a second copy of the
 * clamp in this file would be one more place for it to drift from the truth.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ assets: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_asset_register")
    .select(
      "id, name, acquired_date, cost, salvage_value, useful_life_months, method, status, disposed_date, accumulated_depreciation, net_book_value, remaining_depreciable",
    )
    .order("acquired_date", { ascending: false });

  // "No assets" and "we could not read your assets" are different claims — and only one of them means the
  // company owns nothing.
  if (error) return NextResponse.json({ error: "Could not load the asset register." }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("register"),
      name: z.string().min(1).max(120),
      assetAccountId: z.string().uuid(),
      acquiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cost: z.number().positive().finite(),
      salvageValue: z.number().nonnegative().finite().optional(),
      usefulLifeMonths: z.number().int().positive().max(1200),
      costCenterId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
    })
    .strict()
    // Mirrors the DB's own CHECK. An asset whose salvage >= cost has a negative depreciable base — it
    // would either depreciate backwards or refuse to depreciate at all, and neither is a state anyone
    // meant to create.
    .refine((v) => (v.salvageValue ?? 0) < v.cost, {
      message: "Salvage value must be less than cost — you cannot depreciate below what the thing is worth as scrap.",
    }),
  z
    .object({
      action: z.literal("depreciate"),
      assetId: z.string().uuid(),
      periodId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("dispose"),
      assetId: z.string().uuid(),
      periodId: z.string().uuid(),
      proceeds: z.number().nonnegative().finite(),
      cashCode: z.string().max(20).optional(),
    })
    .strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "register") {
    const { data, error } = await sb
      .from("fin_fixed_assets")
      .insert({
        company_id: companyId,
        name: b.name,
        asset_account_id: b.assetAccountId,
        acquired_date: b.acquiredDate,
        cost: b.cost,
        salvage_value: b.salvageValue ?? 0,
        useful_life_months: b.usefulLifeMonths,
        cost_center_id: b.costCenterId ?? null,
        project_id: b.projectId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    if (!data) return NextResponse.json({ error: "Asset not saved." }, { status: 403 });
    return NextResponse.json({ id: data.id });
  }

  if (b.action === "depreciate") {
    const { data, error } = await sb.rpc("fin_run_depreciation", {
      p_asset_id: b.assetId,
      p_period_id: b.periodId,
    });
    // The RPC's message is the useful one — "fully depreciated (net book value has reached its salvage
    // value)" tells the user the asset's life is over, which is a fact they need. A generic error would
    // read as a bug and send them looking for one.
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // Note: re-running an already-posted period returns the EXISTING entry id. That is not a failure —
    // it is the idempotency guarantee that makes a retried monthly job safe.
    return NextResponse.json({ entryId: data });
  }

  const { data, error } = await sb.rpc("fin_dispose_asset", {
    p_asset_id: b.assetId,
    p_proceeds: b.proceeds,
    p_period_id: b.periodId,
    p_cash_code: b.cashCode ?? "1000",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entryId: data });
}
