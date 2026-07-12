import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/** GET /api/finance/runway — cash on hand, avg monthly burn (trailing 3 months), and runway months. */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ runway: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.rpc("fin_runway");
  if (error) return NextResponse.json({ runway: null });
  return NextResponse.json({ runway: data });
}
