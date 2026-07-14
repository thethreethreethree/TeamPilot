import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/** GET/POST /api/finance/budgets — list budgets / create a budget (enter-level). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ budgets: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data } = await sb.from("fin_budgets").select("id, name, fiscal_year, granularity, status").order("fiscal_year", { ascending: false });
  return NextResponse.json({ budgets: data ?? [] });
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(120),
    fiscalYear: z.number().int().min(2000).max(2100),
    granularity: z.enum(["annual", "quarterly", "monthly"]).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });
  const body = await readBody(req, CreateSchema);
  if (body instanceof NextResponse) return body;

  const { data, error } = await sb
    .from("fin_budgets")
    .insert({ company_id: companyId, name: body.name, fiscal_year: body.fiscalYear, granularity: body.granularity ?? "quarterly", created_by: auth.user.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't create budget (duplicate name or no permission)." }, { status: 400 });
  return NextResponse.json({ id: data.id });
}

/**
 * PATCH /api/finance/budgets — the variance alert threshold (0182).
 *
 * This existed as a settings column since 0149 and did NOTHING: nothing in the database read it, and
 * nothing in the product could write it. Dead config is worse than an absent feature — a settings column
 * IMPLIES a working control, so anyone reading the schema would reasonably conclude overspends were being
 * flagged. They were not being flagged at all.
 */
export async function PATCH(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(
    req,
    z.object({ varianceAlertPct: z.number().min(0).max(100) }).strict(),
  );
  if (b instanceof NextResponse) return b;

  const { error } = await sb
    .from("fin_settings")
    .update({ variance_alert_pct: b.varianceAlertPct })
    .not("company_id", "is", null);   // RLS scopes this to the caller's own company row.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
