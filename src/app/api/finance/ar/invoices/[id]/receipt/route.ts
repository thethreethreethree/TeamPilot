import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/ar/invoices/[id]/receipt — record a payment against a sent invoice via
 * fin_record_receipt (Dr Cash / Cr AR). Over-receipt + foreign-currency are rejected by the RPC.
 */
const BodySchema = z
  .object({
    amount: z.number().positive(),
    receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

  const { data, error } = await sb.rpc("fin_record_receipt", {
    p_invoice_id: id,
    p_amount: body.amount,
    p_receipt_date: body.receiptDate,
    p_cash_code: body.cashCode ?? "1000",
  });
  if (error) {
    console.error("[ar/invoices/receipt] failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, entryId: data });
}
