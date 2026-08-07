import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import {
  buildStoragePath,
  uploadAssetBytes,
  AGENT_MAX_BYTES,
  ASSETS_BUCKET,
  EXECUTABLE_EXTENSIONS,
} from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";

/**
 * POST /api/coach/sales-session/[id]/upload-recording (Live Sales Coach S1a)
 *
 * The agent uploads the full call recording. We:
 *   1. persist the audio (immutable asset, §1.1) to the assets bucket
 *      and stamp coaching_sessions.audio_asset_url,
 *   2. run batch Scribe with diarization (2 speakers),
 *   3. RETURN the diarized segments (speaker_0/speaker_1) + a sample
 *      line per speaker so the agent can one-tap which one is them.
 *
 * We do NOT append the transcript here — segments are append-only and
 * the schema's speaker is agent|customer|unknown, so the labeled
 * transcript is appended by /label-transcript after the tap.
 *
 * UNTESTED: the live ElevenLabs diarization call (needs a real key +
 * recording).
 */
// This route awaits an in-path BATCH TRANSCRIPTION of a full call recording
// (transcribeWithDiarization below) — materially longer than an LLM completion, so
// it gets the longest budget rather than the 60 used on generation routes. Diarizing
// a multi-minute recording can take well past a minute; on Vercel's ~10-15s default
// this route would time out for ANY real recording (the earlier maxDuration sweep
// missed it). NOTE (founder): the effective ceiling is plan-dependent — Hobby clamps
// to 60s, Pro honors up to 300s. If long recordings still time out, that's the plan
// tier, not the code; the alternative is moving transcription to a background job.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-upload",
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
  // RLS-scoped read authorizes access to this session.
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty audio file." }, { status: 400 });
  }
  if (file.size > AGENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `Recording too large (max ${Math.floor(AGENT_MAX_BYTES / 1024 / 1024)}MB).` },
      { status: 413 }
    );
  }
  const mimeType = file.type || "audio/webm";
  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Please upload an audio (or video) recording." },
      { status: 400 }
    );
  }
  // Defense-in-depth: this route can't use validateUploadCandidate (its
  // BLOCKED_EXTENSIONS list rejects .webm/.mp4, which are legitimate recording
  // formats). But the browser-supplied MIME above is spoofable — an executable
  // uploaded as Content-Type: audio/webm would pass the prefix check. Refuse a
  // dangerous executable EXTENSION regardless, while still allowing media exts.
  const lowerName = (file.name || "").toLowerCase();
  if (EXECUTABLE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return NextResponse.json(
      { error: "That file type isn't allowed." },
      { status: 400 }
    );
  }

  const arrayBuf = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  // 1. Persist the audio (immutable asset).
  const storagePath = buildStoragePath({
    companyId,
    fileId: randomUUID(),
    originalFilename: file.name || "recording.webm",
  });
  const up = await uploadAssetBytes({ storagePath, bytes, contentType: mimeType });
  if (!up.ok) {
    return NextResponse.json(
      { error: `Couldn't store the recording: ${up.error ?? "storage error"}` },
      { status: 500 }
    );
  }
  const admin = createAdminClient();
  // Defense-in-depth: this admin (service-role) write bypasses RLS, so scope it to the
  // caller's company as well as the session id. The getSession() read above already proved
  // the caller has access to this session within their company, so today .eq("id") alone
  // targets exactly the right row — but pinning company_id keeps this write tenant-safe on
  // its own, matching the sibling save-recording route, so a future change to how getSession
  // scopes access can't turn this into a cross-tenant write.
  await admin
    .from("coaching_sessions")
    .update({ audio_asset_url: `${ASSETS_BUCKET}/${storagePath}` })
    .eq("id", id)
    .eq("company_id", companyId);

  // 2. Batch diarization.
  let segments;
  try {
    segments = await transcribeWithDiarization({
      audio: Buffer.from(bytes),
      mimeType,
      numSpeakers: 2,
    });
  } catch (err) {
    console.error("[upload-recording] processing failed:", err);
    return NextResponse.json(
      {
        // Rep-facing: plain + actionable, no jargon. The server log above carries the real cause (usually the
        // ElevenLabs STT key/plan — same root as the live "Token mint failed"). The audio IS saved, so retry works.
        error:
          "Couldn't process the recording right now — your audio is saved, so please try again in a moment.",
        audioSaved: true,
      },
      { status: 502 }
    );
  }

  // 3. Distinct speakers + a sample line each, for the one-tap UI.
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
