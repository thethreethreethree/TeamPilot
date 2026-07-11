import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/expenses/reports/[id] — advance a report:
 *   { action: "submit" }    — employee submits their own draft (draft→submitted, RLS-gated).
 *   { action: "approve" }   — fin_approve_expense_report (finance; SoD: not your own; posts GL).
 *   { action: "reimburse", cashCode? } — fin_reimburse_expense_report (Dr payable / Cr Cash).
 */
const BodySchema = z
  .object({
    action: z.enum(["submit", "approve", "reimburse"]),
    cashCode: z.string().max(20).optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  if (body.action === "submit") {
    // Employee submits their own draft. RLS permits own-draft → status in (draft, submitted).
    const { data, error } = await sb
      .from("fin_expense_reports")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "draft")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Couldn't submit — it isn't your draft, or it's no longer a draft." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const rpc = body.action === "approve" ? "fin_approve_expense_report" : "fin_reimburse_expense_report";
  const args =
    body.action === "approve"
      ? { p_report_id: id }
      : { p_report_id: id, p_cash_code: body.cashCode ?? "1000" };
  const { data, error } = await sb.rpc(rpc, args);
  if (error) {
    console.error(`[expenses/${body.action}] failed:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, entryId: data });
}
