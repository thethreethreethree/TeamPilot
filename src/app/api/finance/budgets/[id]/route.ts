import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET   /api/finance/budgets/[id] — this budget's lines with actual + variance (fin_budget_variance).
 * POST  /api/finance/budgets/[id] — add/update a budget line (upsert by account × cost-center × period).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ lines: [] });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data } = await sb
    .from("fin_budget_variance")
    .select("budget_line_id, account_id, code, account_name, type, cost_center_id, period_index, budget, actual")
    .eq("budget_id", id)
    .order("code");
  return NextResponse.json({ lines: data ?? [] });
}

const LineSchema = z
  .object({
    accountId: z.string().uuid(),
    costCenterId: z.string().uuid().optional(),
    periodIndex: z.number().int().min(0).max(12),
    amount: z.number(),
  })
  .strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });
  const body = await readBody(req, LineSchema);
  if (body instanceof NextResponse) return body;

  const { error } = await sb
    .from("fin_budget_lines")
    .upsert(
      {
        company_id: companyId,
        budget_id: id,
        account_id: body.accountId,
        cost_center_id: body.costCenterId ?? null,
        period_index: body.periodIndex,
        amount: body.amount,
      },
      { onConflict: "budget_id,account_id,cost_center_id,period_index" }
    );
  if (error) return NextResponse.json({ error: "Couldn't save the budget line (no permission?)." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
