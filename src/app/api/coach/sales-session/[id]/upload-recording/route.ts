import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  buildStoragePath,
  uploadAssetBytes,
  getAssetObjectInfo,
  downloadAssetBytes,
  AGENT_MAX_BYTES,
  ASSETS_BUCKET,
  EXECUTABLE_EXTENSIONS,
} from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";

/** Distinct speakers + a sample line each, for the one-tap "which voice is you?" UI.
 *  Shared by both entry points (multipart upload + direct-to-storage finalize) so their
 *  response shape can't drift. */
function buildSpeakerResponse(
  segments: Array<{ speakerId: string; text: string }>
) {
  const speakerIds = Array.from(new Set(segments.map((s) => s.speakerId)));
  const speakers = speakerIds.map((sid) => ({
    speakerId: sid,
    sample: segments.find((s) => s.speakerId === sid)?.text.slice(0, 140) ?? "",
  }));
  return {
    segments: segments.map((s, i) => ({
      speakerId: s.speakerId,
      text: s.text,
      seq: i,
    })),
    speakers,
  };
}

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

  // INV19: getSession is COMPANY-scoped, not owner-scoped. Attaching a recording writes to —
  // and the response returns — the call's content, so gate it to the session's OWNER or a Sales
  // Coach MANAGER; a colleague sharing the company must not attach/pull another rep's call.
  // Mirrors /retranscribe's owner gate; applied to BOTH entry points below (multipart + JSON).
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
      { error: "You can only upload a recording to your own sessions." },
      { status: 403 }
    );
  }

  // ── Direct-to-storage finalize (JSON branch) ────────────────────────────────
  // The browser already PUT the bytes straight to Storage via a signed target
  // (/upload-recording/sign), bypassing the ~4.5 MB Vercel serverless body limit that
  // killed real phone recordings on the multipart path below. Here we get only the
  // { storagePath } and transcribe FROM storage (same work as /retranscribe).
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await req.json().catch(() => null)) as
      | { storagePath?: string }
      | null;
    const storagePath =
      typeof body?.storagePath === "string" ? body.storagePath.trim() : "";
    if (!storagePath) {
      return NextResponse.json(
        { error: "Missing 'storagePath' — upload via the signed URL first." },
        { status: 400 }
      );
    }
    // The client-claimed size/type is untrusted — read the REAL object from storage.
    const info = await getAssetObjectInfo(storagePath);
    if (!info) {
      return NextResponse.json(
        {
          error:
            "The uploaded recording wasn't found in storage — please try the upload again.",
        },
        { status: 404 }
      );
    }
    if (info.sizeBytes === 0) {
      return NextResponse.json({ error: "Empty recording." }, { status: 400 });
    }
    if (info.sizeBytes > AGENT_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Recording too large (max ${Math.floor(
            AGENT_MAX_BYTES / 1024 / 1024
          )}MB).`,
        },
        { status: 413 }
      );
    }
    // A voice memo picked from the Files app can arrive with an empty or generic
    // content-type; the sign step already blocked executable extensions before the
    // object existed, so treat empty/octet-stream as audio and only reject a clearly
    // non-media type.
    const storedType = info.contentType ?? "";
    if (
      storedType &&
      storedType !== "application/octet-stream" &&
      !storedType.startsWith("audio/") &&
      !storedType.startsWith("video/")
    ) {
      return NextResponse.json(
        { error: "Please upload an audio (or video) recording." },
        { status: 400 }
      );
    }

    // Stamp the pointer FIRST (recovery contract: the audio survives a transcription
    // failure, so the rep can re-transcribe from storage — same ordering as the
    // multipart branch). Service-role write scoped to the company (defense-in-depth).
    const admin = createAdminClient();
    await admin
      .from("coaching_sessions")
      .update({ audio_asset_url: `${ASSETS_BUCKET}/${storagePath}` })
      .eq("id", id)
      .eq("company_id", companyId);

    // Download the bytes we just confirmed exist, then diarize.
    const dl = await downloadAssetBytes({ storagePath });
    if (!dl.ok || !dl.bytes) {
      console.error(
        `[upload-recording] json download failed session=${id}: ${dl.error ?? "no bytes"}`
      );
      return NextResponse.json(
        {
          error:
            "Couldn't read the uploaded recording right now — your audio is saved, so please try again in a moment.",
          audioSaved: true,
        },
        { status: 502 }
      );
    }
    let jsonSegments;
    try {
      jsonSegments = await transcribeWithDiarization({
        audio: dl.bytes,
        mimeType: dl.contentType || storedType || "audio/webm",
        numSpeakers: 2,
      });
    } catch (err) {
      console.error("[upload-recording] json processing failed:", err);
      return NextResponse.json(
        {
          error:
            "Couldn't process the recording right now — your audio is saved, so please try again in a moment.",
          audioSaved: true,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(buildSpeakerResponse(jsonSegments));
  }

  // ── Multipart branch (legacy / small-file fallback) ─────────────────────────
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
  return NextResponse.json(buildSpeakerResponse(segments));
}
