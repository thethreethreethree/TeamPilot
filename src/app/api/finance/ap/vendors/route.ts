import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET  /api/finance/ap/vendors — list the company's vendors (RLS: finance view access).
 * POST /api/finance/ap/vendors — create a vendor (RLS: finance enter access).
 * Authorization lives in the DB (RLS on fin_vendors); these routes shape input/output only.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ vendors: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_vendors")
    .select("id, name, email, tax_id, terms_days, is_active")
    .order("name");
  if (error) return NextResponse.json({ vendors: [] });
  return NextResponse.json({ vendors: data });
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200).optional(),
    taxId: z.string().max(60).optional(),
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
    .from("fin_vendors")
    .insert({
      company_id: companyId,
      name: body.name,
      email: body.email ?? null,
      tax_id: body.taxId ?? null,
      terms_days: body.termsDays ?? 30,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[ap/vendors] insert failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't create the vendor. You may not have finance-enter permission." },
      { status: 400 }
    );
  }
  return NextResponse.json({ id: data.id });
}
