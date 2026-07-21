import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { signAssetUrl, ASSETS_BUCKET } from "@/lib/storage/assets";

/**
 * GET /api/coach/sales-session/[id]/recording-url — a short-lived signed URL to PLAY the call
 * recording (founder decision 2026-07-21: playback was the missing piece — audio was captured and
 * purged but no surface could consume it, so "recordings" were transcript-only).
 *
 * The assets bucket is PRIVATE and signAssetUrl signs with the admin client (bypasses RLS), so THIS
 * ROUTE is the access gate — never sign without the owner/manager check. Access mirrors save-recording:
 * the owning rep OR a same-company Sales Coach manager. A cross-company / missing session is an
 * indistinguishable 404 (never confirm another tenant's session exists).
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) {
    return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("coaching_sessions")
    .select("id, agent_id, company_id, audio_asset_url")
    .eq("id", id)
    .maybeSingle();
  if (!session || session.company_id !== companyId) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const isOwner = session.agent_id === auth.user.id;
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: companyId,
  });
  if (!isOwner && !isManager) {
    return NextResponse.json(
      { error: "Only the rep or a manager can play this recording." },
      { status: 403 }
    );
  }

  const stored = (session.audio_asset_url as string | null) ?? null;
  if (!stored) {
    // Transcript-only session, or the audio was purged after the 2-day retention window (§3.4 honest).
    return NextResponse.json({ error: "No recording for this session." }, { status: 404 });
  }

  // upload-recording stamps `${ASSETS_BUCKET}/${path}`; signAssetUrl wants the bucket-relative path.
  const storagePath = stored.startsWith(`${ASSETS_BUCKET}/`)
    ? stored.slice(ASSETS_BUCKET.length + 1)
    : stored;
  const url = await signAssetUrl({ storagePath, expiresInSeconds: 600 });
  if (!url) {
    return NextResponse.json(
      { error: "Couldn't prepare the recording — try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url });
}
