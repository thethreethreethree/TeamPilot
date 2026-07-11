import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/accounts — the company's Chart of Accounts (RLS: finance view access). Used by
 * the finance UIs to populate account pickers.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ accounts: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_accounts")
    .select("id, code, name, type, is_active")
    .eq("is_active", true)
    .order("code");
  if (error) return NextResponse.json({ accounts: [] });
  return NextResponse.json({ accounts: data });
}
