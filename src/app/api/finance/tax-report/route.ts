import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/** GET /api/finance/tax-report?from&to — output − input tax by jurisdiction for the period (fin_tax_report). */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ report: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const args: Record<string, string> = {};
  if (from && DATE.test(from)) args.p_from = from;
  if (to && DATE.test(to)) args.p_to = to;
  const { data, error } = await sb.rpc("fin_tax_report", args);
  // A failed read is an error, never an empty answer (2026-11-23): `{ report: … }` here read as "none".
  if (error) {
    console.error(`[finance/tax-report] read failed: ${error.message}`);
    return NextResponse.json({ error: "Could not load this right now." }, { status: 500 });
  }
  return NextResponse.json({ report: data });
}
