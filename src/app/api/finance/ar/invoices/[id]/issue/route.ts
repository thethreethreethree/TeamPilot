import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/finance/ar/invoices/[id]/issue — issue a draft invoice, posting Dr AR / Cr Revenue via
 * fin_issue_invoice (approve-capability + SoD: issuer ≠ creator, enforced in the DB).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.rpc("fin_issue_invoice", { p_invoice_id: id });
  if (error) {
    console.error("[ar/invoices/issue] failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, entryId: data });
}
