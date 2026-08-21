import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { aggregateMeetingDissects } from "@/lib/coach/strategy/meeting/aggregateMeetingDissects";

/**
 * GET /api/coach/meeting-session/trend — the team's "did our meetings improve?" trend (§3.6 make-learning-
 * visible). Aggregates the company's `meeting.dissect_generated` events into a recent-vs-earlier trend on the
 * consequence signals. Company-scoped (a team-level signal, not a specific meeting's private content); pinned to
 * the caller's company (INV15). Honest: below the minimum meetings the aggregate returns direction
 * "insufficient" — no faked curve.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  // Service-role read pinned to the caller's company (INV15) — the events table's payloads are the dissects.
  const { data, error } = await createAdminClient()
    .from("events")
    .select("payload, created_at")
    .eq("company_id", companyId)
    .eq("kind", "meeting.dissect_generated")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[meeting-trend] query failed:", error.message);
    return NextResponse.json({ error: "Couldn't load the meeting trend." }, { status: 500 });
  }

  const trend = aggregateMeetingDissects(data ?? []);
  return NextResponse.json({ trend });
}
