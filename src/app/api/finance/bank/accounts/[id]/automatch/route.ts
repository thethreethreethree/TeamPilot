import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/finance/bank/accounts/[id]/automatch — auto-match unmatched bank lines to posted GL cash
 * lines (equal amount, ±3 days, single candidate). Delegates to fin_auto_match_bank. Returns the count.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.rpc("fin_auto_match_bank", { p_bank_account_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ matched: data });
}
