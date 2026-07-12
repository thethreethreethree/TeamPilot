import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/** GET /api/finance/ap/aging — AP aging buckets (bills owed, by due date) via fin_ap_aging_summary. */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ aging: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.rpc("fin_ap_aging_summary");
  if (error) {
    console.error("[ap/aging] failed:", error.message);
    return NextResponse.json({ aging: null });
  }
  return NextResponse.json({ aging: data });
}
