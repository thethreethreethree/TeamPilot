import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/** GET/POST /api/finance/tax-codes — list / create tax codes (configure-level). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ taxCodes: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data } = await sb.from("fin_tax_codes").select("id, code, name, jurisdiction, rate_pct, kind, direction, is_active").order("code");
  return NextResponse.json({ taxCodes: data ?? [] });
}

const CreateSchema = z
  .object({
    code: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    jurisdiction: z.string().max(80).optional(),
    ratePct: z.number().min(0).max(100),
    kind: z.enum(["sales", "vat", "gst"]).optional(),
    direction: z.enum(["output", "input"]),
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

  const { error } = await sb.from("fin_tax_codes").insert({
    company_id: companyId, code: body.code, name: body.name, jurisdiction: body.jurisdiction ?? null,
    rate_pct: body.ratePct, kind: body.kind ?? "sales", direction: body.direction, created_by: auth.user.id,
  });
  if (error) return NextResponse.json({ error: "Couldn't create tax code (duplicate code or need finance-configure)." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
