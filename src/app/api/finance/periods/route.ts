import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET  /api/finance/periods — list fiscal periods (RLS: finance view).
 * POST /api/finance/periods — create a period (RLS: manage-periods capability). The 0117
 * non-overlap trigger + date CHECK enforce validity in the DB.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ periods: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_periods")
    .select("id, name, start_date, end_date, status")
    .order("start_date", { ascending: false });
  if (error) return NextResponse.json({ periods: [] });
  return NextResponse.json({ periods: data });
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(60),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    .from("fin_periods")
    .insert({
      company_id: companyId,
      name: body.name,
      start_date: body.startDate,
      end_date: body.endDate,
      status: "open",
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) {
    // overlap / bad dates / duplicate name / no permission all surface here (finance-admin facing).
    console.error("[finance/periods] create failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id });
}
