import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/** GET/POST /api/finance/ar/invoices — list / create a DRAFT invoice + lines (RLS: view / enter). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ invoices: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_invoices")
    .select("id, customer_id, invoice_number, invoice_date, due_date, currency, status")
    .order("invoice_date", { ascending: false });
  if (error) return NextResponse.json({ invoices: [] });
  return NextResponse.json({ invoices: data });
}

const CreateSchema = z
  .object({
    customerId: z.string().uuid(),
    invoiceNumber: z.string().min(1).max(100),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    lines: z
      .array(
        z.object({
          revenueAccountId: z.string().uuid(),
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

  const { data: inv, error: invErr } = await sb
    .from("fin_invoices")
    .insert({
      company_id: companyId,
      customer_id: body.customerId,
      invoice_number: body.invoiceNumber,
      invoice_date: body.invoiceDate,
      due_date: body.dueDate ?? null,
      status: "draft",
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (invErr) {
    console.error("[ar/invoices] insert failed:", invErr.message);
    return NextResponse.json({ error: "Couldn't create the invoice (duplicate number or no permission)." }, { status: 400 });
  }

  const lines = body.lines.map((l, i) => ({
    company_id: companyId,
    invoice_id: inv.id,
    line_no: i + 1,
    revenue_account_id: l.revenueAccountId,
    description: l.description ?? null,
    amount: l.amount,
    tax_amount: l.taxAmount ?? 0,
  }));
  const { error: lineErr } = await sb.from("fin_invoice_lines").insert(lines);
  if (lineErr) {
    console.error("[ar/invoices] lines insert failed:", lineErr.message);
    return NextResponse.json({ error: "Invoice created but lines failed — edit the draft.", id: inv.id }, { status: 400 });
  }
  return NextResponse.json({ id: inv.id });
}
