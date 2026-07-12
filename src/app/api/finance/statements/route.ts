import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/statements?from=YYYY-MM-DD&to=YYYY-MM-DD — Trial Balance + P&L + Balance Sheet.
 * from/to are optional (0144): P&L covers [from,to]; Balance Sheet + Trial Balance are as-of `to`.
 * Omitting both = all-time (unchanged). Only well-formed dates are forwarded.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ statements: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const args: Record<string, string> = {};
  if (from && DATE.test(from)) args.p_from = from;
  if (to && DATE.test(to)) args.p_to = to;
  const { data, error } = await sb.rpc("fin_statements", args);
  if (error) {
    console.error("[finance/statements] failed:", error.message);
    return NextResponse.json({ statements: null });
  }
  return NextResponse.json({ statements: data });
}
