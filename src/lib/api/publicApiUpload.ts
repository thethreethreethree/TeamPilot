import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession, setSessionStatus } from "@/lib/data/salesCoach";
import { buildStoragePath, uploadAssetBytes, recordingMaxBytes, ASSETS_BUCKET, EXECUTABLE_EXTENSIONS } from "@/lib/storage/assets";
import { transcribeUploadedAudio } from "@/lib/coach/v5/transcribeUpload";
import { recordAudit } from "@/lib/audit/recordAudit";
import { recordApiUsage, type ApiCaller } from "./publicApi";

/**
 * POST /api/v1/calls — an outside tool uploads a call (Engage plan E6; Gong F6.9; founder pickers 2026-11-27 "Add an
 * 'upload calls' key scope" and, for E10, "Rep picks it in the app"). Multipart: `file` (audio or video), `repId` (one of
 * the key's company's active people), `channel` ("phone" | "video"), optional `startedAt` (ISO, within the last 90 days)
 * and `title`. The key needs the "upload" scope.
 *
 * The call is made for that rep, its audio stored and transcribed exactly as an app upload (transcribeUpload.ts: the words
 * saved as unknown voices), and the rep is told. It is NOT scored yet: the rep opens it, confirms the customer knew it was
 * recorded (the consent rule, "Rep confirms") and says which voice is theirs — that answer scores it, as for any upload.
 * Same file rules as an app upload: the channel's size limit, an audio or video type, no executable name.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE = 80;
const MAX_AGE_MS = 90 * 86_400_000;

/** `caller` is the key the route has already checked for the "upload" scope (authenticateApiKey in the route). */
export async function uploadCall(req: Request, caller: ApiCaller): Promise<NextResponse> {
  const route = "/api/v1/calls";
  const done = async (body: Record<string, unknown>, status: number) => {
    await recordApiUsage(caller, route, status);
    return NextResponse.json(body, { status });
  };

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return done({ error: "Send multipart/form-data with file, repId and channel." }, 400);
  }
  const file = form.get("file");
  const repId = String(form.get("repId") ?? "");
  const channel = String(form.get("channel") ?? "");
  const startedRaw = form.get("startedAt");
  const titleRaw = form.get("title");
  if (!(file instanceof File) || file.size === 0) return done({ error: "Attach the recording as `file`." }, 400);
  if (!UUID.test(repId)) return done({ error: "`repId` must be one of your company's people (their id)." }, 400);
  if (channel !== "phone" && channel !== "video") return done({ error: "`channel` must be \"phone\" or \"video\"." }, 400);
  let startedAt: string | null = null;
  if (typeof startedRaw === "string" && startedRaw) {
    const t = Date.parse(startedRaw);
    if (!Number.isFinite(t) || t > Date.now() + 5 * 60_000 || Date.now() - t > MAX_AGE_MS) return done({ error: "`startedAt` must be a time in the last 90 days." }, 400);
    startedAt = new Date(t).toISOString();
  }
  const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, MAX_TITLE) : null;
  if (file.size > recordingMaxBytes(channel)) return done({ error: `Recording too large (max ${Math.floor(recordingMaxBytes(channel) / 1024 / 1024)} MB).` }, 413);
  const mimeType = file.type || "";
  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) return done({ error: "Upload an audio (or video) recording." }, 400);
  const lowerName = (file.name || "").toLowerCase();
  if (EXECUTABLE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return done({ error: "That file type isn't allowed." }, 400);

  const admin = createAdminClient();
  // The rep must be an active person of the KEY's company (the service role bypasses RLS: this filter is the boundary).
  const { data: rep, error: rErr } = await admin.from("profiles").select("id, status").eq("company_id", caller.companyId).eq("id", repId).maybeSingle();
  if (rErr) return done({ error: "Couldn't check the rep. Try again." }, 503);
  if (!rep || rep.status === "removed") return done({ error: "No active person with that repId in your company." }, 404);

  const session = await createSession({ companyId: caller.companyId, agentId: repId, context: channel, clientLabel: title, startedAt });
  if (!session) return done({ error: "Couldn't create the call. Try again." }, 500);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = buildStoragePath({ companyId: caller.companyId, fileId: randomUUID(), originalFilename: file.name || "recording.webm" });
  const up = await uploadAssetBytes({ storagePath, bytes, contentType: mimeType });
  if (!up.ok) {
    console.error(`[api-upload] storage write failed session=${session.id}: ${up.error ?? "unknown"}`);
    return done({ error: "Couldn't store the recording. Try again.", callId: session.id }, 500);
  }
  const { error: pErr } = await admin.from("coaching_sessions").update({ audio_asset_url: `${ASSETS_BUCKET}/${storagePath}` }).eq("id", session.id).eq("company_id", caller.companyId);
  if (pErr) console.error(`[api-upload] audio pointer not set session=${session.id}: ${pErr.message}`);
  // The call is over: it was recorded elsewhere. Ended, so it reads as a finished call, not a live one.
  await setSessionStatus({ sessionId: session.id, status: "ended", actorId: repId });

  const t = await transcribeUploadedAudio({ companyId: caller.companyId, sessionId: session.id, context: channel, startedAt: session.startedAt, audio: Buffer.from(bytes), mimeType, logTag: "api-upload" });

  // Tell the rep; their answer is what scores the call. Best-effort: the call is on their Calls list either way.
  const { error: nErr } = await admin.from("manager_notifications").insert({
    company_id: caller.companyId, recipient_id: repId, agent_id: repId, session_id: session.id, type: "call_needs_voice",
    payload: { client_label: title },
  });
  if (nErr) console.error(`[api-upload] notification failed session=${session.id}: ${nErr.message}`);
  await recordAudit(admin, { companyId: caller.companyId, actorId: caller.createdBy, action: "call.api_upload", objectType: "coaching_session", objectId: session.id, meta: { keyId: caller.keyId, repId } });

  return done(
    {
      id: session.id,
      status: t.ok ? (t.segments.length ? "waiting_for_rep" : "no_speech") : "transcription_failed",
      note: t.ok
        ? t.segments.length
          ? "Transcribed. The rep confirms consent and picks their voice in EloState; that scores the call."
          : "No speech was found in the recording."
        : "The recording is stored, but it couldn't be transcribed just now; the rep can retry from the call's page.",
    },
    201,
  );
}
