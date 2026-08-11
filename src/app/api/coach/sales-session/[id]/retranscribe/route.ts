import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  downloadAssetBytes,
  assetUrlToStoragePath,
} from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";

/**
 * POST /api/coach/sales-session/[id]/retranscribe (Live Sales Coach — recovery)
 *
 * Recovers a session whose recording was SAVED but whose transcript never
 * landed — the orphaned-recording state produced when ElevenLabs STT was down
 * (the "Token mint failed" outage): the audio uploaded fine but diarization
 * 502'd, so audio_asset_url is set while the transcript is empty.
 *
 * This is the same work as /upload-recording steps 2-3, but sourcing the audio
 * from storage instead of a fresh upload:
 *   1. read the session's stored audio pointer,
 *   2. download the bytes (admin storage client),
 *   3. re-run batch Scribe with diarization (2 speakers),
 *   4. RETURN the diarized segments + a sample line per speaker.
 *
 * Like upload-recording, it does NOT append the transcript — segments are
 * append-only and speaker is agent|customer|unknown, so the labeled transcript
 * is appended by /label-transcript after the human one-taps which speaker is
 * them. This reuses the EXISTING, tested write path (no new prod-write here).
 */

// Batch transcription of a full recording — same long budget as upload-recording
// (diarizing a multi-minute call runs well past a minute). Plan tier still caps
// this: Hobby clamps to 60s, Pro honors up to 300s.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-retranscribe",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // RLS-scoped read authorizes company access to this session.
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  // INV19: getSession is COMPANY-scoped, not owner-scoped. Re-transcription exposes
  // the call's content (the returned segments), so gate it to the session's OWNER or a
  // Sales Coach MANAGER — a colleague must not pull another rep's call content just
  // because they share a company.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  if (session.agentId !== auth.user.id && !isManager) {
    return NextResponse.json(
      { error: "You can only re-transcribe your own sessions." },
      { status: 403 }
    );
  }

  // Must have a saved recording to re-transcribe.
  const storagePath = assetUrlToStoragePath(session.audioAssetUrl);
  if (!session.audioAssetUrl) {
    return NextResponse.json(
      { error: "No saved recording for this session to re-transcribe." },
      { status: 409 }
    );
  }
  if (!storagePath) {
    // Pointer exists but isn't the recognized bucket-relative shape — we can't safely
    // resolve the object (same unrecognized-pointer caution as recording-purge-cron).
    console.error(
      `[retranscribe] unrecognized audio pointer session=${id}: ${session.audioAssetUrl.slice(0, 80)}`
    );
    return NextResponse.json(
      { error: "The saved recording pointer isn't recognized — please re-upload the recording." },
      { status: 422 }
    );
  }

  // 1. Download the stored audio bytes (caller already authorized above).
  const dl = await downloadAssetBytes({ storagePath });
  if (!dl.ok || !dl.bytes) {
    console.error(`[retranscribe] download failed session=${id}: ${dl.error ?? "no bytes"}`);
    return NextResponse.json(
      { error: "Couldn't read the saved recording right now — please try again in a moment." },
      { status: 502 }
    );
  }

  // 2. Batch diarization (same engine as upload-recording).
  let segments;
  let durationSeconds = 0;
  try {
    const t = await transcribeWithDiarization({
      audio: dl.bytes,
      mimeType: dl.contentType || "audio/webm",
      numSpeakers: 2,
    });
    segments = t.segments;
    durationSeconds = t.durationSeconds;
  } catch (err) {
    console.error("[retranscribe] processing failed:", err);
    return NextResponse.json(
      {
        // Same root cause the recovery exists for: the ElevenLabs STT key/scope. The audio is
        // still saved, so retry works once the scope is enabled.
        error:
          "Couldn't process the recording right now — your audio is saved, so please try again in a moment.",
        audioSaved: true,
      },
      { status: 502 }
    );
  }

  // Stamp the REAL audio length (§3.5) so a recovered recording shows its length, not the session
  // wall-clock. Best-effort — the transcript already succeeded above.
  if (durationSeconds > 0) {
    await createAdminClient()
      .from("coaching_sessions")
      .update({ audio_duration_seconds: durationSeconds })
      .eq("id", id)
      .eq("company_id", companyId);
  }

  // 3. Distinct speakers + a sample line each, for the one-tap labeling UI — the
  // SAME shape upload-recording returns, so the existing speaker-tap flow consumes it.
  const speakerIds = Array.from(new Set(segments.map((s) => s.speakerId)));
  const samples = speakerIds.map((sid) => ({
    speakerId: sid,
    sample: segments.find((s) => s.speakerId === sid)?.text.slice(0, 140) ?? "",
  }));

  return NextResponse.json({
    segments: segments.map((s, i) => ({ speakerId: s.speakerId, text: s.text, seq: i })),
    speakers: samples,
  });
}
