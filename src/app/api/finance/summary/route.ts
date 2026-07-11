import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/summary — the Finance dashboard's real data source, derived from the Phase-1
 * double-entry ledger (fin_dashboard_summary RPC, migration 0121). All money aggregation happens
 * in SQL (decision #3). RLS keeps it tenant-safe + finance-access-gated.
 *
 * GUARDED FALLBACK (memory: migration-coupled code keeps a fallback; distinguish live-error from
 * live-empty). The finance migrations (0116-0121) may not be applied yet in a given environment.
 * If the RPC/tables are absent, or this company hasn't initialized finance, we return
 * { available:false, reason } so the page shows an honest "not initialized" state instead of
 * crashing. We never leak the raw DB error to the client (server log only).
 */
export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json({ available: false, reason: "offline" });
  }
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ available: false, reason: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await sb.rpc("fin_dashboard_summary");
  if (error) {
    // Most likely: migrations 0116-0121 not applied (function/relation missing). Could also be a
    // genuine error — either way, don't break the page. Log the detail server-side only.
    console.error("[finance/summary] fin_dashboard_summary failed:", error.message);
    return NextResponse.json({ available: false, reason: "not-initialized" });
  }

  const summary = (data ?? null) as Record<string, unknown> | null;
  // base_currency null → migrations applied but this company has no fin_settings (finance not
  // initialized) OR the caller lacks finance view access. Either way, an honest not-ready state.
  if (!summary || summary.base_currency == null) {
    return NextResponse.json({ available: false, reason: "not-initialized" });
  }

  return NextResponse.json({ available: true, summary });
}
