import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET  /api/finance/ap/bills — list bills (RLS: finance view).
 * POST /api/finance/ap/bills — create a DRAFT bill + its lines (RLS: finance enter). Approval and
 * the GL posting happen later via /bills/[id]/approve. Money is passed as a NUMBER of major units
 * here and stored as numeric(19,4); no arithmetic is done in JS.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ bills: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_bill_summary")
    .select("id, vendor_id, bill_number, bill_date, due_date, currency, status, total, paid")
    .order("bill_date", { ascending: false });
  if (error) return NextResponse.json({ bills: [] });
  return NextResponse.json({ bills: data });
}

const CreateSchema = z
  .object({
    vendorId: z.string().uuid(),
    billNumber: z.string().min(1).max(100),
    billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currency: z.string().length(3).optional(),
    lines: z
      .array(
        z.object({
          accountId: z.string().uuid(),
          description: z.string().max(300).optional(),
          amount: z.number().nonnegative(),
          taxAmount: z.number().nonnegative().optional(),
          costCenterId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          taxCodeId: z.string().uuid().optional(),
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

  const { data: bill, error: billErr } = await sb
    .from("fin_bills")
    .insert({
      company_id: companyId,
      vendor_id: body.vendorId,
      bill_number: body.billNumber,
      bill_date: body.billDate,
      due_date: body.dueDate ?? null,
      currency: body.currency ?? null,
      status: "draft",
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (billErr) {
    console.error("[ap/bills] bill insert failed:", billErr.message);
    return NextResponse.json(
      { error: "Couldn't create the bill (duplicate number, or no finance-enter permission)." },
      { status: 400 }
    );
  }

  const lineRows = body.lines.map((l, i) => ({
    company_id: companyId,
    bill_id: bill.id,
    line_no: i + 1,
    account_id: l.accountId,
    description: l.description ?? null,
    amount: l.amount,
    tax_amount: l.taxAmount ?? 0,
    cost_center_id: l.costCenterId ?? null,
    project_id: l.projectId ?? null,
    tax_code_id: l.taxCodeId ?? null,
  }));
  const { error: lineErr } = await sb.from("fin_bill_lines").insert(lineRows);
  if (lineErr) {
    console.error("[ap/bills] line insert failed:", lineErr.message);
    return NextResponse.json(
      { error: "Bill created but lines failed — edit the draft to add lines.", id: bill.id },
      { status: 400 }
    );
  }
  return NextResponse.json({ id: bill.id });
}
