import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET  /api/finance/expenses/reports — list reports the caller may see (own, or all if finance).
 * POST /api/finance/expenses/reports — an employee creates their OWN draft report + items.
 * RLS enforces "own report" on insert; the employee_user_id is the caller.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ reports: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_expense_report_summary")
    .select("id, title, status, employee_user_id, submitted_at, approved_at, reimbursed_at, total")
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ reports: [] });
  return NextResponse.json({ reports: data });
}

const CreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    items: z
      .array(
        z.object({
          accountId: z.string().uuid(),
          description: z.string().max(300).optional(),
          category: z.string().max(80).optional(),
          amount: z.number().nonnegative(),
          taxAmount: z.number().nonnegative().optional(),
          expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          receiptUrl: z.string().url().max(1000).optional(),
          costCenterId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
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

  const { data: report, error: rErr } = await sb
    .from("fin_expense_reports")
    .insert({
      company_id: companyId,
      employee_user_id: auth.user.id,
      title: body.title,
      status: "draft",
    })
    .select("id")
    .single();
  if (rErr) {
    console.error("[expenses/reports] insert failed:", rErr.message);
    return NextResponse.json({ error: "Couldn't create the report." }, { status: 400 });
  }

  const items = body.items.map((it, i) => ({
    company_id: companyId,
    report_id: report.id,
    line_no: i + 1,
    account_id: it.accountId,
    description: it.description ?? null,
    category: it.category ?? null,
    amount: it.amount,
    tax_amount: it.taxAmount ?? 0,
    expense_date: it.expenseDate ?? null,
    receipt_url: it.receiptUrl ?? null,
    cost_center_id: it.costCenterId ?? null,
    project_id: it.projectId ?? null,
  }));
  const { error: iErr } = await sb.from("fin_expense_items").insert(items);
  if (iErr) {
    console.error("[expenses/reports] items insert failed:", iErr.message);
    return NextResponse.json({ error: "Report created but items failed — edit the draft.", id: report.id }, { status: 400 });
  }
  return NextResponse.json({ id: report.id });
}
