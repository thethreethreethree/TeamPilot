import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/gl?accountId=… — posted journal lines for one account (drill-down from any
 * balance to its source transactions; the "every figure traceable" non-negotiable). fin_gl_detail
 * is RLS-scoped (security invoker + auth_company_id()).
 */
export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ lines: [] });
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.rpc("fin_gl_detail", { p_account_id: accountId });
  if (error) {
    console.error("[finance/gl] failed:", error.message);
    return NextResponse.json({ lines: [] });
  }
  return NextResponse.json({ lines: data ?? [] });
}
