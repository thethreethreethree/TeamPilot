import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET/POST /api/finance/ar/credit-notes — list / create a DRAFT credit note + lines (RLS: view / enter).
 * A credit note reduces an issued invoice's outstanding; issuing it (separate endpoint) posts the
 * reversing GL entry (Dr Sales Returns 4900 / Dr Tax Payable / Cr AR). Contra-revenue treatment.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ creditNotes: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_credit_note_summary")
    .select("id, customer_id, invoice_id, credit_number, credit_date, status, reason, total")
    .order("credit_date", { ascending: false });
  if (error) return NextResponse.json({ creditNotes: [] });
  return NextResponse.json({ creditNotes: data });
}

const CreateSchema = z
  .object({
    customerId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    creditNumber: z.string().min(1).max(100),
    creditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(300).optional(),
    lines: z
      .array(
        z.object({
          description: z.string().max(300).optional(),
          amount: z.number().nonnegative(),
          taxAmount: z.number().nonnegative().optional(),
        })
      )
      .min(1)
      .max(200),
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

  const { data: cn, error: cnErr } = await sb
    .from("fin_credit_notes")
    .insert({
      company_id: companyId,
      customer_id: body.customerId,
      invoice_id: body.invoiceId,
      credit_number: body.creditNumber,
      credit_date: body.creditDate,
      reason: body.reason ?? null,
      status: "draft",
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (cnErr) {
    console.error("[ar/credit-notes] insert failed:", cnErr.message);
    return NextResponse.json({ error: "Couldn't create the credit note (duplicate number or no permission)." }, { status: 400 });
  }

  const lines = body.lines.map((l, i) => ({
    company_id: companyId,
    credit_note_id: cn.id,
    line_no: i + 1,
    description: l.description ?? null,
    amount: l.amount,
    tax_amount: l.taxAmount ?? 0,
  }));
  const { error: lineErr } = await sb.from("fin_credit_note_lines").insert(lines);
  if (lineErr) {
    console.error("[ar/credit-notes] lines insert failed:", lineErr.message);
    return NextResponse.json({ error: "Credit note created but lines failed — edit the draft.", id: cn.id }, { status: 400 });
  }
  return NextResponse.json({ id: cn.id });
}
