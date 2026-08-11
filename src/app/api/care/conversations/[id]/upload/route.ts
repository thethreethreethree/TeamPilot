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
  getAssetObjectInfo,
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
 *
 * TWO entry points (mirroring the Sales-Coach recording upload):
 *   1. JSON finalize branch — the browser already PUT the bytes DIRECT to
 *      Storage via /upload/sign, bypassing the ~4.5 MB Vercel body limit that
 *      killed any real phone photo / scanned PDF. We get { storagePath, filename }
 *      and attach the object we re-read from storage. This is the path the widget
 *      uses now.
 *   2. Multipart branch — legacy / small-file fallback (bytes through the function
 *      body). Kept so nothing regresses for tiny attachments or non-JS callers.
 */

/**
 * Shared attach-tail for both entry points: create the files row, post the inline
 * attachment message, emit the §3.1 asset event. Keeps the two branches from
 * drifting on how a customer attachment is recorded (the same reason the recording
 * route shares buildSpeakerResponse). Returns the API response.
 */
async function attachCustomerFile(args: {
  conv: { id: string; companyId: string };
  token: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
}): Promise<NextResponse> {
  const { conv, token, storagePath, mimeType, sizeBytes, filename } = args;
  let row;
  try {
    row = await createFileRecord({
      companyId: conv.companyId,
      uploaderId: null,
      customerSessionToken: token,
      storagePath,
      mimeType,
      sizeBytes,
      originalFilename: filename,
      title: filename,
      description: null,
      accessRole: "everyone",
      uploadedVia: "customer_widget",
      linkedConversationId: conv.id,
    });
  } catch (err) {
    // PUBLIC customer endpoint — log the raw cause for the operator, return a generic message. A raw DB
    // exception (table/column names) must never reach an unauthenticated customer (CWE-209). Audit 2026-07-27.
    const detail = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[care.upload] file row write failed conv=${conv.id}: ${detail}`);
    return NextResponse.json(
      { error: "Failed to save the file. Please try again." },
      { status: 500 }
    );
  }
  if (!row) {
    // Customer-facing (support widget) — plain English, not DB jargon ("file row").
    return NextResponse.json(
      { error: "Couldn't attach your file right now — please try again." },
      { status: 500 }
    );
  }
  // 0058 — post an attachment-kind support_messages row so the
  // agent sees the file inline in the conversation thread, not
  // only via the library filter. Body = filename; media_url
  // carries the file pointer for the inline render path.
  const posted = await postCustomerMessage({
    conversationId: conv.id,
    body: row.title,
    kind: "attachment",
    mediaUrl: `assets-v1://${row.id}`,
    mediaType: row.mimeType,
  });
  if (!posted) {
    // §3.4 honesty (A16 — the agent tail already does this; the customer tail must match, not
    // silently 200): the file uploaded and is in the library, but the inline attachment message
    // did NOT post — so the AGENT won't see it in the thread. Surface it as a partial + let the
    // widget offer a retry, instead of returning success the customer reads as "they got it".
    // The file row persists (recoverable). postCustomerMessage already logged the cause.
    return NextResponse.json(
      {
        error:
          "Your file was saved but couldn't be attached to the conversation — please try sending it again.",
        file: row,
      },
      { status: 502 }
    );
  }
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

  // ── Direct-to-storage finalize (JSON branch) ────────────────────────────────
  // The browser already PUT the bytes straight to Storage via /upload/sign,
  // bypassing the ~4.5 MB Vercel body limit. Here we get only { storagePath,
  // filename } and re-read the REAL object before attaching anything.
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      storagePath?: string;
      filename?: string;
    } | null;
    const storagePath =
      typeof body?.storagePath === "string" ? body.storagePath.trim() : "";
    const filename =
      typeof body?.filename === "string" && body.filename.trim()
        ? body.filename.trim()
        : "attachment";
    if (!storagePath) {
      return NextResponse.json(
        { error: "Missing 'storagePath' — upload via the signed URL first." },
        { status: 400 }
      );
    }
    // SECURITY (audit F1 lesson): storagePath is UNTRUSTED caller input, and getAssetObjectInfo below uses
    // the ADMIN client (RLS bypass). buildStoragePath mints "<companyId>/<yyyy>/<mm>/<uuid>.ext", so a
    // legitimate path for this conversation starts with its own companyId. Require that prefix so a finalize
    // can't be pointed at ANOTHER company's object — closes cross-company by CONSTRUCTION.
    if (!storagePath.startsWith(`${conv.companyId}/`)) {
      return NextResponse.json(
        { error: "That file doesn't belong to this conversation." },
        { status: 403 }
      );
    }
    // The client-claimed size/type is untrusted — read the REAL object from storage.
    const info = await getAssetObjectInfo(storagePath);
    if (!info) {
      return NextResponse.json(
        {
          error:
            "Your file wasn't found in storage — please try attaching it again.",
        },
        { status: 404 }
      );
    }
    // Authoritative gate: re-run the SAME allow-list/cap/extension check against the
    // REAL stored size + content-type (not the client's claim). A browser can lie at
    // sign time; it can't lie about what actually landed in the bucket.
    const realType = info.contentType || "application/octet-stream";
    const v = validateUploadCandidate({
      sizeBytes: info.sizeBytes,
      mimeType: realType,
      filename,
      uploadedVia: "customer_widget",
    });
    if (!v.ok) {
      return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
    }
    return attachCustomerFile({
      conv,
      token,
      storagePath,
      mimeType: realType,
      sizeBytes: info.sizeBytes,
      filename,
    });
  }

  // ── Multipart branch (legacy / small-file fallback) ─────────────────────────
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
      { error: "Couldn't save your file right now — please try again in a moment." },
      { status: 500 }
    );
  }
  return attachCustomerFile({
    conv,
    token,
    storagePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    filename: file.name,
  });
}
