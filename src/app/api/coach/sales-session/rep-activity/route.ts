import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager, canManagerViewRepSkills } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * GET /api/coach/sales-session/rep-activity?agentId=<rep> — a rep's recent SESSION ACTIVITY for the manager to monitor
 * usage (founder 2026-08-27: "view session not working — reps consistently using it aren't showing up").
 *
 * The /recordings endpoint only surfaces sessions that STILL HAVE AUDIO and are within the 2-day window — so a rep who
 * used the product but whose captures have no stored audio (or whose sessions are older than 2 days) is invisible, and
 * the manager cannot see their usage. This endpoint shows the rep's sessions REGARDLESS of audio, over a wider window,
 * with hasAudio as an attribute — so "who is using it, how much, when" is answerable. §A18: activity, never a ranking.
 *
 * Same authz as /recordings: a manager may read a rep in their OWN company; anyone else 403/404. §3.4: honest empty.
 */

const WINDOW_DAYS = 30;
const CAP = 100;

type Row = {
  id: string;
  client_label: string | null;
  status: string;
  started_at: string;
  audio_asset_url: string | null;
  recording_saved?: boolean;
};

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-rep-activity", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });

  const requestedAgentId = new URL(req.url).searchParams.get("agentId");
  let targetAgentId = auth.user.id;
  if (requestedAgentId && requestedAgentId !== auth.user.id) {
    const caller = {
      role: profile?.role ?? null,
      sales_coach_role: profile?.sales_coach_role ?? null,
      company_id: companyId,
    };
    if (!isSalesCoachManager(caller)) {
      return NextResponse.json({ error: "Only a manager can view a rep's activity." }, { status: 403 });
    }
    const { data: target } = await sb.from("profiles").select("company_id").eq("id", requestedAgentId).maybeSingle();
    if (!canManagerViewRepSkills(caller, target ?? null).ok) {
      return NextResponse.json({ error: "Rep not found in your team." }, { status: 404 });
    }
    targetAgentId = requestedAgentId;
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const base = (cols: string) =>
    admin
      .from("coaching_sessions")
      .select(cols)
      .eq("company_id", companyId)
      .eq("agent_id", targetAgentId)
      .gte("started_at", cutoff)
      .order("started_at", { ascending: false })
      .limit(CAP);

  // recording_saved lands with migration 0187; degrade gracefully if it isn't applied yet (migration-coupling lesson).
  let rows: Row[] | null;
  let savingAvailable = true;
  const first = await base("id, client_label, status, started_at, audio_asset_url, recording_saved");
  if (first.error) {
    if (!isMissingColumnError(first.error, "recording_saved")) {
      console.error("[rep-activity GET] failed:", first.error);
      return NextResponse.json({ error: "Couldn't load activity." }, { status: 500 });
    }
    savingAvailable = false;
    const fb = await base("id, client_label, status, started_at, audio_asset_url");
    if (fb.error) return NextResponse.json({ error: "Couldn't load activity." }, { status: 500 });
    rows = (fb.data ?? []) as unknown as Row[];
  } else {
    rows = (first.data ?? []) as unknown as Row[];
  }

  const sessions = (rows ?? []).map((r) => ({
    id: r.id,
    clientLabel: r.client_label ?? null,
    status: r.status,
    startedAt: r.started_at,
    hasAudio: Boolean(r.audio_asset_url),
    saved: Boolean(r.recording_saved),
  }));
  return NextResponse.json({
    sessions,
    totalCount: sessions.length,
    // The list is capped at CAP most-recent; tell the client so it can say "showing most recent N" rather than
    // implying the list is complete for a very active rep (review F2).
    atCap: sessions.length >= CAP,
    lastActiveAt: sessions[0]?.startedAt ?? null,
    windowDays: WINDOW_DAYS,
    cap: CAP,
    savingAvailable,
  });
}
