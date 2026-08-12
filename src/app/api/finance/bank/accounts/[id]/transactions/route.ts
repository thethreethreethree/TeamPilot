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
  // The register shows the most recent transactions. Cap at PostgREST's max_rows (1000) — the honest
  // single-page max, matching assetReadout's FILE_SCAN_CAP — NOT a false 2000-row limit that silently returns the
  // same <=1000 while looking bounded. A busy account has older lines this page doesn't list; rather than hide
  // that silently (the honesty-thesis failure, §3.4), head-count the total and DISCLOSE the truncation so the UI
  // can say "showing the most recent 1,000 of N". A load-older / paginated register UI is the founder-gated next
  // step; this makes the existing cap honest in the meantime.
  const PAGE_MAX = 1000;
  const { data, error } = await sb
    .from("fin_bank_transactions")
    .select("id, txn_date, amount, description, external_id, status, source")
    .eq("bank_account_id", id)
    .order("txn_date", { ascending: false })
    .limit(PAGE_MAX);
  if (error) return NextResponse.json({ transactions: [] });
  const rows = data ?? [];
  // Only pay for the exact count when the page is full (otherwise the returned rows ARE the total).
  let total = rows.length;
  if (rows.length >= PAGE_MAX) {
    const { count } = await sb
      .from("fin_bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("bank_account_id", id);
    if (typeof count === "number") total = count;
  }
  return NextResponse.json({ transactions: rows, total, truncated: total > rows.length });
}
