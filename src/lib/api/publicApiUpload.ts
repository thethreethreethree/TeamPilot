import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession, setSessionStatus, type SalesSession } from "@/lib/data/salesCoach";
import {
  buildStoragePath,
  createSignedUploadTarget,
  downloadAssetBytes,
  getAssetObjectInfo,
  uploadAssetBytes,
  recordingMaxBytes,
  ASSETS_BUCKET,
  EXECUTABLE_EXTENSIONS,
} from "@/lib/storage/assets";
import { transcribeUploadedAudio } from "@/lib/coach/v5/transcribeUpload";
import { recordAudit } from "@/lib/audit/recordAudit";
import { recordApiUsage, type ApiCaller } from "./publicApi";

/**
 * Upload a call by API (Engage plan E6; Gong F6.9; founder pickers 2026-11-27 "Add an 'upload calls' key scope" and, for
 * E10, "Rep picks it in the app"). The key needs the "upload" scope; the route checks it (authenticateApiKey).
 *
 * TWO WAYS IN (review 2026-11-27: Vercel refuses a request body over ~4.5 MB before the function runs, so a one-request
 * upload failed for any call past ~5 minutes — the app's own upload signs a direct upload for the same reason):
 *   1. JSON {repId, channel, startedAt?, title?, filename, sizeBytes, mimeType} → the call is made and a signed storage
 *      upload returned; the tool PUTs the file there, then POSTs /api/v1/calls/:id/finalize. The file is named after the
 *      call, so finalize attaches only that file to only that call.
 *   2. multipart {file, repId, channel, startedAt?, title?} for small files (under the platform's limit).
 * Either way the call is made for one of the KEY's company's active reps, its audio checked like an app upload (the
 * channel's size limit, an audio or video type, no executable name), ended, transcribed by the app upload's own steps
 * (transcribeUpload.ts), and the rep told. It is NOT scored here: the rep confirms consent and picks their voice in the
 * app, which scores it. At most UPLOADS_PER_DAY calls a day per key, counted when a call is made (before any
 * transcription), so a leaked key can't run up speech-to-text spend.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE = 80;
const MAX_AGE_MS = 90 * 86_400_000;
export const UPLOADS_PER_DAY = 200;
const ROUTE = "/api/v1/calls";

type Meta = { repId: string; channel: "phone" | "video"; startedAt: string | null; title: string | null };

function done(caller: ApiCaller, body: Record<string, unknown>, status: number, route = ROUTE) {
  return recordApiUsage(caller, route, status).then(() => NextResponse.json(body, { status }));
}

function readMeta(get: (k: string) => unknown): Meta | string {
  const repId = String(get("repId") ?? "");
  const channel = String(get("channel") ?? "");
  const startedRaw = get("startedAt");
  const titleRaw = get("title");
  if (!UUID.test(repId)) return "`repId` must be one of your company's people (their id).";
  if (channel !== "phone" && channel !== "video") return "`channel` must be \"phone\" or \"video\".";
  let startedAt: string | null = null;
  if (typeof startedRaw === "string" && startedRaw) {
    const t = Date.parse(startedRaw);
    if (!Number.isFinite(t) || t > Date.now() + 5 * 60_000 || Date.now() - t > MAX_AGE_MS) return "`startedAt` must be a time in the last 90 days.";
    startedAt = new Date(t).toISOString();
  }
  const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, MAX_TITLE) : null;
  return { repId, channel, startedAt, title };
}

/** The app upload's file rules on a claimed or stored size and type. Null when acceptable, else the error and status. */
function fileProblem(channel: string, size: number, type: string, name: string): { error: string; status: number } | null {
  if (size <= 0) return { error: "The recording is empty.", status: 400 };
  if (size > recordingMaxBytes(channel)) return { error: `Recording too large (max ${Math.floor(recordingMaxBytes(channel) / 1024 / 1024)} MB).`, status: 413 };
  if (type && type !== "application/octet-stream" && !type.startsWith("audio/") && !type.startsWith("video/")) return { error: "Upload an audio (or video) recording.", status: 400 };
  if (EXECUTABLE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) return { error: "That file type isn't allowed.", status: 400 };
  return null;
}

/** The rep is an active person of the KEY's company, and the key is under its daily upload count. Null when fine. */
async function precheck(admin: ReturnType<typeof createAdminClient>, caller: ApiCaller, repId: string): Promise<{ error: string; status: number } | null> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: cErr } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("company_id", caller.companyId).eq("action", "call.api_upload").eq("meta->>keyId", caller.keyId).gte("created_at", since);
  if (cErr) return { error: "Couldn't check this key's uploads. Try again.", status: 503 };
  if ((count ?? 0) >= UPLOADS_PER_DAY) return { error: `This key has uploaded ${UPLOADS_PER_DAY} calls in the last 24 hours.`, status: 429 };
  // The service role bypasses RLS: this company filter is the boundary.
  const { data: rep, error: rErr } = await admin.from("profiles").select("id, status").eq("company_id", caller.companyId).eq("id", repId).maybeSingle();
  if (rErr) return { error: "Couldn't check the rep. Try again.", status: 503 };
  if (!rep || rep.status === "removed") return { error: "No active person with that repId in your company.", status: 404 };
  return null;
}

/**
 * An optional `Idempotency-Key` header (review 2026-11-27): a tool that retries after a timeout sends the same value and
 * gets the first call back instead of a second one (and a second transcription). Per API key, for 24 hours.
 */
export function idempotencyKey(req: Request): string | null {
  const v = (req.headers.get("idempotency-key") ?? "").trim();
  return /^[A-Za-z0-9._:-]{8,100}$/.test(v) ? v : null;
}

async function earlierCall(admin: ReturnType<typeof createAdminClient>, caller: ApiCaller, idem: string | null): Promise<string | null | "failed"> {
  if (!idem) return null;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await admin.from("audit_log").select("object_id").eq("company_id", caller.companyId).eq("action", "call.api_upload").eq("meta->>keyId", caller.keyId).eq("meta->>idem", idem).gte("created_at", since).limit(1).maybeSingle();
  if (error) return "failed";
  return data ? String(data.object_id) : null;
}

/** Make the call for the rep, and record it (the record is what the daily count and a retry's lookup read). */
async function startCall(admin: ReturnType<typeof createAdminClient>, caller: ApiCaller, m: Meta, idem: string | null): Promise<SalesSession | null> {
  const session = await createSession({ companyId: caller.companyId, agentId: m.repId, context: m.channel, clientLabel: m.title, startedAt: m.startedAt });
  if (!session) return null;
  await recordAudit(admin, { companyId: caller.companyId, actorId: caller.createdBy, action: "call.api_upload", objectType: "coaching_session", objectId: session.id, meta: { keyId: caller.keyId, repId: m.repId, ...(idem ? { idem } : {}) } });
  return session;
}

/** A retry with an Idempotency-Key already used: the first call, as it stands (never a second one). */
async function replay(admin: ReturnType<typeof createAdminClient>, caller: ApiCaller, id: string) {
  const { data } = await admin.from("coaching_sessions").select("id, audio_asset_url").eq("company_id", caller.companyId).eq("id", id).maybeSingle();
  return done(caller, { id, replayed: true, hasRecording: !!data?.audio_asset_url, finalize: `/api/v1/calls/${id}/finalize`, note: "This Idempotency-Key already made this call; nothing new was created." }, 200);
}

/** The audio is stored: point the call at it, end it, transcribe it, tell the rep. */
async function finishCall(admin: ReturnType<typeof createAdminClient>, caller: ApiCaller, session: { id: string; agentId: string; startedAt: string | null; context: string; clientLabel?: string | null }, storagePath: string, audio: Buffer, mimeType: string, route: string) {
  const { error: pErr } = await admin.from("coaching_sessions").update({ audio_asset_url: `${ASSETS_BUCKET}/${storagePath}` }).eq("id", session.id).eq("company_id", caller.companyId);
  if (pErr) {
    console.error(`[api-upload] audio pointer not set session=${session.id}: ${pErr.message}`);
    return done(caller, { error: "Couldn't attach the recording. Try finalize again.", id: session.id }, 500, route);
  }
  // Recorded elsewhere, so over: ended, it reads as a finished call (and the rep's "Pick your voice" shows on it).
  const ended = (await setSessionStatus({ sessionId: session.id, status: "ended", actorId: session.agentId })) ?? (await setSessionStatus({ sessionId: session.id, status: "ended", actorId: session.agentId }));
  if (!ended) console.error(`[api-upload] couldn't end session=${session.id}; the auto-close job will`);
  const t = await transcribeUploadedAudio({ companyId: caller.companyId, sessionId: session.id, context: session.context as "phone" | "video", startedAt: session.startedAt, audio, mimeType, logTag: "api-upload" });
  const { error: nErr } = await admin.from("manager_notifications").insert({
    company_id: caller.companyId, recipient_id: session.agentId, agent_id: session.agentId, session_id: session.id, type: "call_needs_voice",
    payload: { client_label: session.clientLabel ?? null },
  });
  if (nErr) console.error(`[api-upload] notification failed session=${session.id}: ${nErr.message}`);
  return done(
    caller,
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
    route,
  );
}

/** POST /api/v1/calls. */
export async function uploadCall(req: Request, caller: ApiCaller): Promise<NextResponse> {
  const admin = createAdminClient();
  const multipart = (req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data");
  if (multipart) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return done(caller, { error: "Send multipart/form-data with file, repId and channel — or JSON for a signed upload (large files)." }, 400);
    }
    const m = readMeta((k) => form.get(k));
    if (typeof m === "string") return done(caller, { error: m }, 400);
    const file = form.get("file");
    if (!(file instanceof File)) return done(caller, { error: "Attach the recording as `file`." }, 400);
    const bad = fileProblem(m.channel, file.size, file.type || "", file.name || "");
    if (bad) return done(caller, { error: bad.error }, bad.status);
    if (!(file.type || "").startsWith("audio/") && !(file.type || "").startsWith("video/")) return done(caller, { error: "Upload an audio (or video) recording." }, 400);
    const idem = idempotencyKey(req);
    const prior = await earlierCall(admin, caller, idem);
    if (prior === "failed") return done(caller, { error: "Couldn't check the Idempotency-Key. Try again." }, 503);
    if (prior) return replay(admin, caller, prior);
    const pre = await precheck(admin, caller, m.repId);
    if (pre) return done(caller, { error: pre.error }, pre.status);
    const session = await startCall(admin, caller, m, idem);
    if (!session) return done(caller, { error: "Couldn't create the call. Try again." }, 500);
    const bytes = Buffer.from(await file.arrayBuffer());
    const storagePath = buildStoragePath({ companyId: caller.companyId, fileId: session.id, originalFilename: file.name || "recording.webm" });
    const up = await uploadAssetBytes({ storagePath, bytes, contentType: file.type });
    if (!up.ok) {
      console.error(`[api-upload] storage write failed session=${session.id}: ${up.error ?? "unknown"}`);
      return done(caller, { error: "Couldn't store the recording. Try again.", id: session.id }, 500);
    }
    return finishCall(admin, caller, session, storagePath, bytes, file.type, ROUTE);
  }

  // JSON: a signed direct upload for files of any size up to the channel's limit.
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return done(caller, { error: "Send JSON {repId, channel, filename, sizeBytes, mimeType} for a signed upload, or multipart for a small file." }, 400);
  }
  const m = readMeta((k) => b[k]);
  if (typeof m === "string") return done(caller, { error: m }, 400);
  const filename = typeof b.filename === "string" ? b.filename.slice(0, 400) : "";
  const sizeBytes = Number(b.sizeBytes);
  const mimeType = typeof b.mimeType === "string" ? b.mimeType.trim().slice(0, 200) : "";
  if (!filename || !Number.isInteger(sizeBytes)) return done(caller, { error: "Give the file's `filename` and `sizeBytes` (and `mimeType`)." }, 400);
  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) return done(caller, { error: "Upload an audio (or video) recording (`mimeType`)." }, 400);
  const bad = fileProblem(m.channel, sizeBytes, mimeType, filename);
  if (bad) return done(caller, { error: bad.error }, bad.status);
  const idem = idempotencyKey(req);
  const prior = await earlierCall(admin, caller, idem);
  if (prior === "failed") return done(caller, { error: "Couldn't check the Idempotency-Key. Try again." }, 503);
  if (prior) return replay(admin, caller, prior);
  const pre = await precheck(admin, caller, m.repId);
  if (pre) return done(caller, { error: pre.error }, pre.status);
  const session = await startCall(admin, caller, m, idem);
  if (!session) return done(caller, { error: "Couldn't create the call. Try again." }, 500);
  // Named after the call (fileId = its id): finalize accepts only this file for only this call.
  const target = await createSignedUploadTarget({ companyId: caller.companyId, fileId: session.id, originalFilename: filename });
  if (!target.ok) {
    console.error(`[api-upload] signed target failed session=${session.id}: ${target.error}`);
    return done(caller, { error: "Couldn't start the upload. Try again.", id: session.id }, 500);
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return done(
    caller,
    {
      id: session.id,
      upload: { method: "PUT", url: `${base}/storage/v1/object/upload/sign/${ASSETS_BUCKET}/${target.storagePath}?token=${encodeURIComponent(target.token)}`, path: target.storagePath, headers: { "Content-Type": mimeType } },
      finalize: `/api/v1/calls/${session.id}/finalize`,
      note: "PUT the file to upload.url, then POST {\"path\": upload.path} to finalize.",
    },
    201,
  );
}

/** POST /api/v1/calls/:id/finalize {path} — after the signed upload. */
export async function finalizeCall(req: Request, caller: ApiCaller, id: string): Promise<NextResponse> {
  const route = "/api/v1/calls/finalize";
  if (!UUID.test(id)) return done(caller, { error: "No such call." }, 404, route);
  let b: { path?: unknown };
  try {
    b = (await req.json()) as { path?: unknown };
  } catch {
    return done(caller, { error: "Send JSON {path}." }, 400, route);
  }
  const path = typeof b.path === "string" ? b.path : "";
  // Only this call's own file, in this company's space (named after the call when the upload was signed).
  const own = new RegExp(`^${caller.companyId}/\\d{4}/\\d{2}/${id}(\\.[a-z0-9]{1,12})?$`);
  if (!own.test(path)) return done(caller, { error: "That path isn't this call's upload." }, 403, route);
  const admin = createAdminClient();
  const { data: s, error: sErr } = await admin.from("coaching_sessions").select("id, agent_id, context, started_at, client_label, audio_asset_url").eq("company_id", caller.companyId).eq("id", id).maybeSingle();
  if (sErr) return done(caller, { error: "Couldn't read the call. Try again." }, 503, route);
  if (!s) return done(caller, { error: "No such call." }, 404, route);
  // Only a call made through the API (its record), once.
  const { count, error: aErr } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("company_id", caller.companyId).eq("action", "call.api_upload").eq("object_id", id);
  if (aErr) return done(caller, { error: "Couldn't read the call. Try again." }, 503, route);
  if (!count) return done(caller, { error: "That call wasn't made through the API." }, 403, route);
  if (s.audio_asset_url) return done(caller, { error: "This call already has its recording.", id }, 409, route);
  const info = await getAssetObjectInfo(path);
  if (!info) return done(caller, { error: "The file wasn't found — PUT it to the upload URL first." }, 404, route);
  const bad = fileProblem(String(s.context), info.sizeBytes, info.contentType ?? "", path);
  if (bad) return done(caller, { error: bad.error }, bad.status, route);
  const dl = await downloadAssetBytes({ storagePath: path });
  if (!dl.ok || !dl.bytes) return done(caller, { error: "Couldn't read the uploaded file. Try finalize again." }, 502, route);
  return finishCall(
    admin,
    caller,
    { id: String(s.id), agentId: String(s.agent_id), startedAt: (s.started_at as string | null) ?? null, context: String(s.context), clientLabel: (s.client_label as string | null) ?? null },
    path,
    dl.bytes,
    dl.contentType || info.contentType || "audio/webm",
    route,
  );
}
