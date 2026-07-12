import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/** GET /api/finance/bank/accounts/[id]/transactions — imported bank lines for reconciliation (RLS-scoped). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ transactions: [] });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_bank_transactions")
    .select("id, txn_date, amount, description, external_id, status, source")
    .eq("bank_account_id", id)
    .order("txn_date", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ transactions: [] });
  return NextResponse.json({ transactions: data });
}
