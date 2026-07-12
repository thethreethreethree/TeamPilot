import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/ar/collections — the collections worklist: overdue invoices (days_overdue > 0)
 * with outstanding balance, most-overdue first. From the fin_ar_aging view (RLS-scoped). This is
 * the derivable half of dunning; sending reminders is an email-integration follow-up.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ overdue: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_ar_aging")
    .select("invoice_number, customer_name, outstanding, days_overdue")
    .gt("days_overdue", 0)
    .gt("outstanding", 0)
    .order("days_overdue", { ascending: false });
  if (error) {
    console.error("[ar/collections] failed:", error.message);
    return NextResponse.json({ overdue: [] });
  }
  return NextResponse.json({ overdue: data ?? [] });
}
