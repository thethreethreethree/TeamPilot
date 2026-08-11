import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/api/rateLimit";
import { getCareConversationByToken } from "@/lib/data/care";
import {
  createSignedUploadTarget,
  validateUploadCandidate,
  ASSETS_BUCKET,
} from "@/lib/storage/assets";

/**
 * POST /api/care/conversations/[id]/upload/sign
 *
 * Mints a SIGNED UPLOAD target so the CUSTOMER's browser uploads the file DIRECT
 * to Storage, bypassing the ~4.5 MB Vercel serverless request-body limit
 * (src/lib/storage/assets.ts:307) that silently killed any attachment above
 * ~4.5 MB on the multipart /upload path. A phone photo or a scanned PDF from a
 * support conversation is routinely 5–10 MB — impossible through the function
 * body, fine straight to Storage. The client then PUTs the bytes with this token
 * and POSTs { storagePath, filename } to /upload (JSON branch), which re-reads
 * the REAL object and attaches it. Mirrors the proven Sales-Coach
 * upload-recording/sign endpoint.
 *
 * Auth: the widget session token (x-care-session), NOT user auth — the visitor
 * is not an auth.users row. createSignedUploadTarget uses the admin client, so
 * no user session is needed; the token only authorizes THIS conversation.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limited = rateLimit(req, {
    id: "care-upload-sign",
    windowMs: 60_000,
    max: 6,
  });
  if (limited) return limited;

  const token = req.headers.get("x-care-session");
  if (!token) {
    return NextResponse.json({ error: "Missing session token." }, { status: 401 });
  }
  const conv = await getCareConversationByToken(token);
  if (!conv || conv.id !== id) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  if (conv.status === "closed") {
    return NextResponse.json({ error: "Conversation closed." }, { status: 410 });
  }

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

  // Same allow-list + cap + executable-extension block the multipart branch
  // enforces (customer_widget: images/pdf, 10 MB). The client-claimed size/type
  // is untrusted — this is a fast reject; the /upload finalize re-validates the
  // REAL stored object before creating any record (the authoritative gate).
  const v = validateUploadCandidate({
    sizeBytes,
    mimeType,
    filename,
    uploadedVia: "customer_widget",
  });
  if (!v.ok) {
    return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
  }

  const target = await createSignedUploadTarget({
    companyId: conv.companyId,
    fileId: randomUUID(),
    originalFilename: filename,
  });
  if (!target.ok) {
    // PUBLIC customer endpoint — log the raw cause for the operator, return a generic
    // message (CWE-209: never echo a backend string to an unauthenticated visitor).
    // eslint-disable-next-line no-console
    console.error(`[care.upload/sign] target mint failed conv=${id}: ${target.error}`);
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
