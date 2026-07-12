import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/** GET/POST /api/finance/ap/pos — list / create a DRAFT purchase order + lines (RLS-gated). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ pos: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_purchase_orders")
    .select("id, vendor_id, po_number, order_date, expected_date, status")
    .order("order_date", { ascending: false });
  if (error) return NextResponse.json({ pos: [] });
  return NextResponse.json({ pos: data });
}

const CreateSchema = z
  .object({
    vendorId: z.string().uuid(),
    poNumber: z.string().min(1).max(100),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    lines: z
      .array(
        z.object({
          accountId: z.string().uuid(),
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

  const { data: po, error: poErr } = await sb
    .from("fin_purchase_orders")
    .insert({
      company_id: companyId,
      vendor_id: body.vendorId,
      po_number: body.poNumber,
      order_date: body.orderDate,
      expected_date: body.expectedDate ?? null,
      status: "draft",
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (poErr) {
    console.error("[ap/pos] insert failed:", poErr.message);
    return NextResponse.json({ error: "Couldn't create the PO (duplicate number or no permission)." }, { status: 400 });
  }

  const lines = body.lines.map((l, i) => ({
    company_id: companyId,
    po_id: po.id,
    line_no: i + 1,
    account_id: l.accountId,
    description: l.description ?? null,
    amount: l.amount,
    tax_amount: l.taxAmount ?? 0,
  }));
  const { error: lineErr } = await sb.from("fin_po_lines").insert(lines);
  if (lineErr) {
    console.error("[ap/pos] lines insert failed:", lineErr.message);
    return NextResponse.json({ error: "PO created but lines failed — edit the draft.", id: po.id }, { status: 400 });
  }
  return NextResponse.json({ id: po.id });
}
