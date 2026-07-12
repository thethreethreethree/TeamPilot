import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/** GET/POST /api/finance/ap/recurring — list / create a recurring-bill template (RLS-gated). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ templates: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_recurring_bills")
    .select("id, vendor_id, description, account_id, amount, tax_amount, frequency, next_date, is_active")
    .order("next_date");
  if (error) return NextResponse.json({ templates: [] });
  return NextResponse.json({ templates: data });
}

const CreateSchema = z
  .object({
    vendorId: z.string().uuid(),
    description: z.string().min(1).max(200),
    accountId: z.string().uuid(),
    amount: z.number().nonnegative(),
    taxAmount: z.number().nonnegative().optional(),
    frequency: z.enum(["weekly", "monthly", "quarterly", "annual"]),
    nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    .from("fin_recurring_bills")
    .insert({
      company_id: companyId,
      vendor_id: body.vendorId,
      description: body.description,
      account_id: body.accountId,
      amount: body.amount,
      tax_amount: body.taxAmount ?? 0,
      frequency: body.frequency,
      next_date: body.nextDate,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[ap/recurring] insert failed:", error.message);
    return NextResponse.json({ error: "Couldn't create the recurring template." }, { status: 400 });
  }
  return NextResponse.json({ id: data.id });
}
