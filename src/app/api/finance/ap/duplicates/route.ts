import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/ap/duplicates — possible duplicate bills (same vendor + same total, ≤7 days apart).
 * Derived from fin_duplicate_bill_candidates (RLS-scoped). A candidate to review, not a verdict.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ duplicates: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_duplicate_bill_candidates")
    .select("bill_id, vendor_name, bill_number, bill_date, status, total, other_bill_number, other_bill_date, other_status, days_apart")
    .order("total", { ascending: false })
    .limit(100);
  // A failed read is an error, never an empty answer (2026-11-23): `{ duplicates: … }` here read as "none".
  if (error) {
    console.error(`[finance/ap/duplicates] read failed: ${error.message}`);
    return NextResponse.json({ error: "Could not load this right now." }, { status: 500 });
  }
  return NextResponse.json({ duplicates: data ?? [] });
}
