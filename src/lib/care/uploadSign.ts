import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  createSignedUploadTarget,
  validateUploadCandidate,
  ASSETS_BUCKET,
} from "@/lib/storage/assets";

/**
 * Shared tail for the two C.A.R.E `…/sign` endpoints (customer `upload/sign` + agent `agent-upload/sign`):
 * parse the client-claimed { filename, sizeBytes, mimeType } → validateUploadCandidate (the up-front
 * allow-list/cap/executable-ext reject) → createSignedUploadTarget → return { bucket, storagePath, token }
 * (or a validation 400 / a generic 500 on a mint failure, never the raw backend string — CWE-209).
 *
 * Extracted 2026-08-12 so a security fix to the mint/validation flow applies to BOTH endpoints automatically
 * (the A16 apply-here-miss-there class this session kept paying for). The CALLER performs its own auth +
 * conversation-access gate FIRST and passes the SERVER-derived companyId — this helper never sees the auth
 * context or a client-supplied tenant, so it cannot weaken the gate. The client-claimed size/type is a fast
 * reject only; the `/upload` + `/agent-upload` finalize branches re-validate the REAL stored object (the
 * authoritative gate).
 */
export async function mintCareUploadTarget(args: {
  req: NextRequest;
  companyId: string;
  uploadedVia: "customer_widget" | "agent_dashboard";
  /** Log prefix for a mint failure (e.g. "care.upload/sign") — the raw cause is logged, never returned. */
  logTag: string;
}): Promise<NextResponse> {
  const { req, companyId, uploadedVia, logTag } = args;

  const body = (await req.json().catch(() => null)) as {
    filename?: string;
    sizeBytes?: number;
    mimeType?: string;
  } | null;
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : NaN;
  const mimeType =
    typeof body?.mimeType === "string" && body.mimeType.trim()
      ? body.mimeType.trim()
      : "application/octet-stream";
  if (!filename) {
    return NextResponse.json({ error: "Missing 'filename'." }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "Missing or empty file." }, { status: 400 });
  }

  const v = validateUploadCandidate({ sizeBytes, mimeType, filename, uploadedVia });
  if (!v.ok) {
    return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
  }

  const target = await createSignedUploadTarget({
    companyId,
    fileId: randomUUID(),
    originalFilename: filename,
  });
  if (!target.ok) {
    // Log the raw cause; return a generic message (CWE-209 — never echo the backend/storage-config string).
    // eslint-disable-next-line no-console
    console.error(`[${logTag}] target mint failed company=${companyId}: ${target.error}`);
    return NextResponse.json(
      { error: "Couldn't start the upload right now — please try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket: ASSETS_BUCKET,
    storagePath: target.storagePath,
    token: target.token,
  });
}
