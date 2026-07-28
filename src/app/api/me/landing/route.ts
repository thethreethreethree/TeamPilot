import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserLanding } from "@/lib/nav/landing";

/**
 * GET /api/me/landing — where the signed-in user should land after auth, resolved
 * from their module levers (see resolveUserLanding). Called by the login flow so
 * a returning care/sales_coach user lands in their module instead of the /dashboard
 * hub. Falls back to /dashboard on any uncertainty (unauthenticated, no company).
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ landing: "/dashboard" });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const landing = await resolveUserLanding(sb, auth.user.id, profile?.company_id ?? null);
  return NextResponse.json({ landing });
}
