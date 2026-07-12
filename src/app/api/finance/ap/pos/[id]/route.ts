import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/ap/pos/[id] — advance a purchase order:
 *   { action: "approve" }  — fin_approve_po (approver; SoD: not your own).
 *   { action: "convert", billNumber, billDate } — fin_convert_po_to_bill → returns the draft bill id.
 */
const BodySchema = z
  .object({
    action: z.enum(["approve", "convert"]),
    billNumber: z.string().min(1).max(100).optional(),
    billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  if (body.action === "approve") {
    const { error } = await sb.rpc("fin_approve_po", { p_po_id: id });
    if (error) {
      console.error("[ap/pos/approve] failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // convert
  if (!body.billNumber || !body.billDate) {
    return NextResponse.json({ error: "billNumber and billDate required to convert." }, { status: 400 });
  }
  const { data, error } = await sb.rpc("fin_convert_po_to_bill", {
    p_po_id: id,
    p_bill_number: body.billNumber,
    p_bill_date: body.billDate,
  });
  if (error) {
    console.error("[ap/pos/convert] failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, billId: data });
}
