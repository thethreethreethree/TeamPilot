import { NextResponse } from "next/server";
import { detectSupportPatterns } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/agent/patterns
 *
 * Returns categories that show up >=3 times in the last 30 days.
 * The §3.2 Understanding Gate for support: a recurring issue
 * becomes a Pattern when it has enough evidence. From here the
 * team can choose to escalate it to a Problem in the §3.1 chain
 * (Sprint 6 wires this end-to-end).
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const patterns = await detectSupportPatterns({});
  return NextResponse.json({ patterns });
}
