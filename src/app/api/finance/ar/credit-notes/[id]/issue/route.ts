import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/finance/ar/credit-notes/[id]/issue — issue a draft credit note.
 * Delegates to fin_issue_credit_note (SECURITY DEFINER): capability (approve) + SoD (creator≠issuer)
 * + open-period + over-credit guard, then posts Dr Sales Returns 4900 / Dr Tax Payable / Cr AR and
 * reduces the invoice's outstanding.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb.rpc("fin_issue_credit_note", { p_credit_note_id: id });
  if (error) {
    // The RPC raises human-readable messages (SoD, over-credit, no open period, etc.) — surface them.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ entryId: data });
}
