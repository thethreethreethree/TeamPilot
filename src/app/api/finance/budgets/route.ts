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
