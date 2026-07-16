import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager, canManagerViewRepSkills } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * GET /api/coach/sales-session/recordings[?agentId=<rep>] — the recordings the Sessions tab shows.
 *
 * ELOSALES Standard revision (PDF Sessions item 1b): "the manager can see all their recordings the past 2 days."
 * Returns the target rep's sessions that still have a recording AND are either within the 2-day window OR have
 * been saved (saved recordings are exempt from the 0187 purge, so they remain visible past 2 days).
 *
 * DEFAULT (no agentId / =self): the rep's own recordings (A10 self-view). MANAGER read (agentId != caller):
 * gated by the same tested authz as skills — manager AND same company, else 403/404. Admin client reads the
 * rep's rows; the in-code gate is the authority. Standard-only surface. This endpoint returns the LIST +
 * metadata + saved-state only.
 *
 * CORRECTION (2026-07-17) — an earlier version of this comment claimed "playback reuses the existing session
 * detail page (/dashboard/sales-coach/[id])". That was asserted, not verified, and it is FALSE: no surface in
 * this product plays a session's audio. `audio_asset_url` is written by upload-recording, filtered here, and
 * nulled by the retention purge — and read by nothing that renders a player. The detail page this list links to
 * shows transcript / review / summary / pivot, which is a real review surface, but it is not playback. So a
 * "recording" here means the session RECORD (transcript + scores) plus a stored audio file that currently no
 * human can hear (A31: written, protected and purged, never read). Retention/Save therefore guard an asset with
 * no realized consumer. Surfaced to the founder as OPEN ⑦ rather than silently fixed — adding call-audio
 * playback is a privacy-bearing capability, not a defect repair (A24e).
 */

const RETENTION_DAYS = 2;

type RecordingRow = {
  id: string;
  client_label: string | null;
  created_at: string;
  recording_saved?: boolean;
};

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

  const scope = (cols: string) =>
    admin
      .from("coaching_sessions")
      .select(cols)
      .eq("company_id", companyId)
      .eq("agent_id", targetAgentId)
      .not("audio_asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

  // Preferred query: still-existing recordings within the window OR saved (saved = exempt from the 0187 purge).
  const { data: rows, error } = await scope("id, client_label, created_at, recording_saved, audio_asset_url")
    .or(`created_at.gte.${cutoff},recording_saved.eq.true`);

  // GUARDED FALLBACK (2026-07-03 migration-coupling lesson): the recording_saved column lands with migration
  // 0187. Until it's applied, the query above fails with undefined_column (42703) and the whole Sessions
  // recordings surface would go dark. Distinguish that specific "column not yet there" case from a real error,
  // and fall back to the 2-day window — the spec's literal core ("recordings from the past 2 days"). This is
  // lossless pre-0187: with no column, nothing can be saved, so "window OR saved" == "window" anyway.
  if (error) {
    // Only "recording_saved isn't in the schema yet" degrades; every other error stays loud (§3.4).
    if (!isMissingColumnError(error, "recording_saved")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: windowRows, error: fbError } = await scope("id, client_label, created_at, audio_asset_url")
      .gte("created_at", cutoff);
    if (fbError) {
      return NextResponse.json({ error: fbError.message }, { status: 500 });
    }
    return NextResponse.json({
      recordings: ((windowRows ?? []) as unknown as RecordingRow[]).map((r) => ({
        id: r.id,
        clientLabel: r.client_label ?? null,
        createdAt: r.created_at,
        saved: false,
      })),
      retentionDays: RETENTION_DAYS,
      // Honest signal: the save-past-2-days exemption isn't live yet (0187 unapplied). §3.4 — say what's true.
      savingAvailable: false,
    });
  }

  return NextResponse.json({
    recordings: ((rows ?? []) as unknown as RecordingRow[]).map((r) => ({
      id: r.id,
      clientLabel: r.client_label ?? null,
      createdAt: r.created_at,
      saved: Boolean(r.recording_saved),
    })),
    retentionDays: RETENTION_DAYS,
    savingAvailable: true,
  });
}
