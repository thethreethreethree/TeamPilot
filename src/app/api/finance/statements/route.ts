import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/** GET /api/finance/statements — Trial Balance + P&L + Balance Sheet, derived (fin_statements). */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ statements: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.rpc("fin_statements");
  if (error) {
    console.error("[finance/statements] failed:", error.message);
    return NextResponse.json({ statements: null });
  }
  return NextResponse.json({ statements: data });
}
