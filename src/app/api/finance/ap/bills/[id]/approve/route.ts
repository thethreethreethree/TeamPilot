import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/finance/ap/bills/[id]/approve — approve a draft bill, posting its GL entry via the
 * fin_approve_bill RPC (approve-capability enforced in the DB). Returns the posted entry id.
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

  const { data, error } = await sb.rpc("fin_approve_bill", { p_bill_id: id });
  if (error) {
    // The RPC raises friendly, specific messages (not authorized / no open period / no lines / not
    // draft) — safe to surface to a finance user. Also log server-side.
    console.error("[ap/bills/approve] failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, entryId: data });
}
