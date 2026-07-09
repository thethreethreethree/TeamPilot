import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getCareConversationByToken,
  postCustomerMessage,
} from "@/lib/data/care";
import { createFileRecord } from "@/lib/data/files";
import { emitAssetEvent } from "@/lib/data/assetEvents";
import {
  buildStoragePath,
  uploadAssetBytes,
  validateUploadCandidate,
} from "@/lib/storage/assets";

/**
 * POST /api/care/conversations/[id]/upload
 *
 * Customer-side file upload from the C.A.R.E widget.
 * Authenticated by x-care-session header (not user auth).
 *
 * Per founder red-pen 2026-06-19:
 *   • 10 MB cap (stricter than agent's 25 MB)
 *   • Images + PDF only (stricter than agent's full allow list)
 *   • Auto-classified to the conversation context:
 *     - title = original filename
 *     - description = null (no classification gate for
 *       customer uploads in v1; customer is not an asset-author)
 *     - linked_conversation_id = THIS conversation
 *     - uploaded_via = 'customer_widget'
 *
 * The file lands in casual lane (no department/task tied; the
 * cap doesn't apply to customers because customers aren't
 * subject to the team's 3/day discipline).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limited = rateLimit(req, {
    id: "care-upload",
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
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' part." }, { status: 400 });
  }
  const v = validateUploadCandidate({
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    // Pass the filename so the BLOCKED_EXTENSIONS check fires (Audit F2 / security
    // 2026-07-09): the browser-supplied MIME is spoofable, so a customer could
    // upload evil.exe with Content-Type image/png and satisfy the image/ allow
    // list. The extension block-list is the defense-in-depth for exactly that —
    // it was tested but never wired into this PUBLIC route. Legit image/pdf
    // extensions are not in BLOCKED_EXTENSIONS, so this adds no false positives.
    filename: file.name,
    uploadedVia: "customer_widget",
  });
  if (!v.ok) {
    return NextResponse.json(
      { error: v.detail, reason: v.reason },
      { status: 400 }
    );
  }
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    companyId: conv.companyId,
    fileId,
    originalFilename: file.name,
  });
  const bytes = await file.arrayBuffer();
  const up = await uploadAssetBytes({
    storagePath,
    bytes,
    contentType: file.type || "application/octet-stream",
  });
  if (!up.ok) {
    // eslint-disable-next-line no-console
    console.error(`[care.upload] storage failed conv=${id}: ${up.error}`);
    return NextResponse.json(
      { error: `Upload failed: ${up.error}` },
      { status: 500 }
    );
  }
  let row;
  try {
    row = await createFileRecord({
      companyId: conv.companyId,
      uploaderId: null,
      customerSessionToken: token,
      storagePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      originalFilename: file.name,
      title: file.name,
      description: null,
      accessRole: "everyone",
      uploadedVia: "customer_widget",
      linkedConversationId: conv.id,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to write file row: ${detail}` },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json(
      { error: "Failed to write file row." },
      { status: 500 }
    );
  }
  // 0058 — post an attachment-kind support_messages row so the
  // agent sees the file inline in the conversation thread, not
  // only via the library filter. Body = filename; media_url
  // carries the file pointer for the inline render path.
  await postCustomerMessage({
    conversationId: conv.id,
    body: row.title,
    kind: "attachment",
    mediaUrl: `assets-v1://${row.id}`,
    mediaType: row.mimeType,
  });
  // §3.1 chain event. Per migration 0054 lesson, actor is null
  // for customer uploads (visitor is not an auth.users row); the
  // events table actor column is nullable.
  await emitAssetEvent({
    companyId: conv.companyId,
    actor: null,
    kind: "asset.file.uploaded",
    fileId: row.id,
    payload: {
      uploaded_via: "customer_widget",
      size_bytes: row.sizeBytes,
      mime_type: row.mimeType,
      linked_conversation_id: conv.id,
    },
  });
  return NextResponse.json({ file: row });
}
