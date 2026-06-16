import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/me/identity
 *
 * Tiny endpoint that returns the calling user's id + role. Used by
 * client-side UIs (e.g. Care Conversations) that need to filter
 * "Mine" without a heavier identity load.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ userId: null });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("role, full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  return NextResponse.json({
    userId: auth.user.id,
    role: profile?.role ?? null,
    fullName: profile?.full_name ?? null,
  });
}
