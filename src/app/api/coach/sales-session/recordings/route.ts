import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager, canManagerViewRepSkills } from "@/lib/coach/v5/skillAccess";

/**
 * GET /api/coach/sales-session/recordings[?agentId=<rep>] — the recordings the Sessions tab shows.
 *
 * ELOSALES Standard revision (PDF Sessions item 1b): "the manager can see all their recordings the past 2 days."
 * Returns the target rep's sessions that still have a recording AND are either within the 2-day window OR have
 * been saved (saved recordings are exempt from the 0187 purge, so they remain visible past 2 days).
 *
 * DEFAULT (no agentId / =self): the rep's own recordings (A10 self-view). MANAGER read (agentId != caller):
 * gated by the same tested authz as skills — manager AND same company, else 403/404. Admin client reads the
 * rep's rows; the in-code gate is the authority. Standard-only surface. Playback reuses the existing session
 * detail page (/dashboard/sales-coach/[id]); this endpoint returns the LIST + metadata + saved-state only.
 */

const RETENTION_DAYS = 2;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-recordings", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) {
    return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });
  }

  const requestedAgentId = new URL(req.url).searchParams.get("agentId");
  let targetAgentId = auth.user.id;
  if (requestedAgentId && requestedAgentId !== auth.user.id) {
    const caller = {
      role: profile?.role ?? null,
      sales_coach_role: profile?.sales_coach_role ?? null,
      company_id: companyId,
    };
    if (!isSalesCoachManager(caller)) {
      return NextResponse.json(
        { error: "Only a manager can view a rep's recordings." },
        { status: 403 }
      );
    }
    const { data: target } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", requestedAgentId)
      .maybeSingle();
    if (!canManagerViewRepSkills(caller, target ?? null).ok) {
      return NextResponse.json({ error: "Rep not found in your team." }, { status: 404 });
    }
    targetAgentId = requestedAgentId;
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Recordings that still exist (audio present) AND are within the window OR saved (saved = exempt from purge).
  const { data: rows, error } = await admin
    .from("coaching_sessions")
    .select("id, client_label, created_at, recording_saved, audio_asset_url")
    .eq("company_id", companyId)
    .eq("agent_id", targetAgentId)
    .not("audio_asset_url", "is", null)
    .or(`created_at.gte.${cutoff},recording_saved.eq.true`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    recordings: (rows ?? []).map((r) => ({
      id: r.id,
      clientLabel: r.client_label ?? null,
      createdAt: r.created_at,
      saved: Boolean(r.recording_saved),
    })),
    retentionDays: RETENTION_DAYS,
  });
}
