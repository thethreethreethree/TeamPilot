import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/** GET/POST /api/finance/ar/customers — list / create customers (RLS: view / enter). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ customers: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_customers")
    .select("id, name, email, terms_days, is_active")
    .order("name");
  if (error) return NextResponse.json({ customers: [] });
  return NextResponse.json({ customers: data });
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200).optional(),
    termsDays: z.number().int().min(0).max(365).optional(),
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
    .from("fin_customers")
    .insert({
      company_id: companyId,
      name: body.name,
      email: body.email ?? null,
      terms_days: body.termsDays ?? 30,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[ar/customers] insert failed:", error.message);
    return NextResponse.json({ error: "Couldn't create the customer." }, { status: 400 });
  }
  return NextResponse.json({ id: data.id });
}
