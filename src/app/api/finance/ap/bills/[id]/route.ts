import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/ap/bills/[id] — a bill's lines + its posted GL entry (drill-down / traceability).
 * RLS-scoped: fin_bill_lines + fin_source_postings + fin_journal_lines all carry the company pin.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseEnabled) return NextResponse.json({ lines: [], gl: [] });
  const { id } = await params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: lines } = await sb
    .from("fin_bill_lines")
    .select("line_no, account_id, description, amount, tax_amount")
    .eq("bill_id", id)
    .order("line_no");

  // The GL entry this bill posted (via the source-posting link) → its lines with account context.
  const { data: posting } = await sb
    .from("fin_source_postings")
    .select("entry_id")
    .eq("source_type", "ap_bill")
    .eq("source_id", id)
    .maybeSingle();

  let gl: unknown[] = [];
  if (posting?.entry_id) {
    const { data: glLines } = await sb
      .from("fin_journal_lines")
      .select("line_no, account_id, base_debit, base_credit, memo")
      .eq("entry_id", posting.entry_id)
      .order("line_no");
    gl = glLines ?? [];
  }

  return NextResponse.json({ lines: lines ?? [], gl });
}
