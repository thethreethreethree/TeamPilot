import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { resolveCoachingMode } from "@/lib/coach/strategy/resolveCoachingMode";
import { assetUrlToStoragePath, downloadAssetBytes } from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { generateAndStoreMeetingDissect } from "@/lib/coach/strategy/meeting/generateMeetingDissect";
import type { StrategyTranscriptSegment } from "@/lib/coach/strategy/coachingStrategy";

/**
 * POST /api/coach/meeting-session/[id]/dissect — the post-meeting review (Phase 6).
 *
 * A meeting doesn't persist a live transcript (the durable AUDIO is the source of truth), so the dissect is
 * produced from a BATCH re-transcription of the audio WITH diarization — which also gives the N-party speaker
 * attribution the live single-mic stream couldn't (the enhancement half of Decision #1, now realized post-hoc).
 * The stored `meeting.dissect_generated` event IS the cache: if one exists we return it WITHOUT re-charging STT
 * or the LLM (the sales retranscribe cost-loop lesson). `?force=1` regenerates. Owner-gated (the facilitator's
 * own meeting); meeting/huddle only.
 */
export const maxDuration = 300; // batch diarization of a multi-minute meeting runs well past the default.

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "meeting-session-dissect", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }
  // Owner-only: the dissect re-transcribes (STT cost) + surfaces the meeting's content. Mirrors the cue route.
  if (session.agentId !== auth.user.id) {
    return NextResponse.json({ error: "Only the session's facilitator can review it." }, { status: 403 });
  }
  if (resolveCoachingMode(session.sessionKind) === "sales") {
    return NextResponse.json({ error: "This session is not a meeting or huddle." }, { status: 400 });
  }

  const admin = createAdminClient();
  const subject = `meeting_session:${id}`;
  const force = new URL(req.url).searchParams.get("force") === "1";

  // The stored dissect event is the cache — return it without re-charging STT/LLM unless ?force=1.
  if (!force) {
    const { data: existing } = await admin
      .from("events")
      .select("payload")
      .eq("company_id", companyId)
      .eq("subject", subject)
      .eq("kind", "meeting.dissect_generated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.payload) {
      return NextResponse.json({ dissect: existing.payload, cached: true });
    }
  }

  // Need the durable audio to review a meeting (there is no persisted transcript to fall back on).
  const storagePath = assetUrlToStoragePath(session.audioAssetUrl);
  if (!session.audioAssetUrl || !storagePath) {
    return NextResponse.json(
      { error: "No saved recording for this meeting yet — the audio may still be stitching, or the meeting wasn't recorded." },
      { status: 409 }
    );
  }

  const dl = await downloadAssetBytes({ storagePath });
  if (!dl.ok || !dl.bytes) {
    console.error(`[meeting-dissect] download failed session=${id}: ${dl.error ?? "no bytes"}`);
    return NextResponse.json({ error: "Couldn't read the saved recording right now — please try again." }, { status: 502 });
  }

  let segments: StrategyTranscriptSegment[];
  try {
    // Omit numSpeakers → auto-detect N participants (a meeting is N-party, unlike the sales 2-party call).
    const t = await transcribeWithDiarization({ audio: dl.bytes, mimeType: dl.contentType || "audio/webm" });
    segments = t.segments.map((s, i) => ({ speaker: s.speakerId, text: s.text, seq: i }));
  } catch (err) {
    console.error(`[meeting-dissect] transcription failed session=${id}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't transcribe the meeting audio right now — please try again." }, { status: 502 });
  }

  const dissect = await generateAndStoreMeetingDissect({
    companyId,
    actorId: auth.user.id,
    sessionId: id,
    sessionTitle: session.clientLabel ?? undefined,
    segments,
  });

  return NextResponse.json({ dissect, cached: false });
}
