import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { createFileRecord } from "@/lib/data/files";
import { postAgentMessage, fetchAgentConversation } from "@/lib/data/care";
import {
  buildStoragePath,
  uploadAssetBytes,
  getAssetObjectInfo,
  validateUploadCandidate,
} from "@/lib/storage/assets";
import { emitAssetEvent } from "@/lib/data/assetEvents";
import { autoRouteFile } from "@/lib/files/autoRoute";
import { classifyFile } from "@/lib/data/files";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/care/conversations/[id]/agent-upload
 *
 * Agent-side file upload from the C.A.R.E composer. Combines:
 *   • upload to Supabase Storage (direct-to-storage OR multipart)
 *   • files row creation (linked to this conversation)
 *   • support_messages attachment-kind row posting
 *
 * Single endpoint = single logical attach from the composer.
 * 25 MB agent cap, agent allow list (images / pdf / docs /
 * audio). RLS still enforces company isolation at the row
 * level.
 *
 * TWO entry points (mirroring the Sales-Coach recording upload):
 *   1. JSON finalize branch — the browser already PUT the bytes DIRECT to
 *      Storage via /agent-upload/sign, bypassing the ~4.5 MB Vercel body limit
 *      that killed any real >4.5 MB attachment (a scan, a screen recording).
 *      We get { storagePath, filename } and attach the object re-read from storage.
 *   2. Multipart branch — legacy / small-file fallback (bytes through the function
 *      body). Kept so nothing regresses for tiny attachments or non-JS callers.
 */

/**
 * Shared attach-tail for both entry points: auto-route, create the files row,
 * apply the classification, post the inline attachment message, emit the §3.1
 * asset event. Keeps the two branches from drifting on how an agent attachment is
 * recorded/routed (the same reason the recording route shares buildSpeakerResponse).
 * Returns the API response.
 */
async function attachAgentFile(args: {
  companyId: string;
  agentId: string;
  conversationId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  isInternalNote: boolean;
}): Promise<NextResponse> {
  const {
    companyId,
    agentId,
    conversationId,
    storagePath,
    mimeType,
    sizeBytes,
    filename,
    isInternalNote,
  } = args;

  // Auto-route the upload via deterministic rules. Per §A11 —
  // System counts derived from facts (linked conversation,
  // uploader department, filename, support-department lookup).
  const routed = await autoRouteFile({
    uploaderId: agentId,
    companyId,
    fileName: filename,
    mimeType,
    linkedConversationId: conversationId,
    source: "care_agent",
  });

  let row;
  try {
    row = await createFileRecord({
      companyId,
      uploaderId: agentId,
      customerSessionToken: null,
      storagePath,
      mimeType,
      sizeBytes,
      originalFilename: filename,
      title: routed.title || filename,
      description: routed.description,
      accessRole: "everyone",
      uploadedVia: "agent_dashboard",
      linkedConversationId: conversationId,
    });
  } catch (err) {
    // Log the raw cause; return a generic message (consistent with the customer upload path). Authed agent
    // route, so lower risk, but a raw DB error shouldn't reach any client + the operator had no log. Audit 2026-07-27.
    const detail = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[care.agent-upload] file row write failed conv=${conversationId}: ${detail}`);
    return NextResponse.json(
      { error: "Failed to save the file. Please try again." },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json(
      { error: "File row write failed." },
      { status: 500 }
    );
  }

  // Apply the routed classification (departments + tags). Tasks
  // are typically empty for C.A.R.E uploads (conversations aren't
  // tasks). The classification trigger derives the lane.
  if (
    routed.departmentIds.length > 0 ||
    routed.taskIds.length > 0 ||
    routed.tags.length > 0
  ) {
    await classifyFile({
      fileId: row.id,
      departmentIds: routed.departmentIds,
      taskIds: routed.taskIds,
      tags: routed.tags,
    });
    const adminSb = createAdminClient();
    await adminSb.from("file_classification_suggestions").insert({
      file_id: row.id,
      suggested_department_ids: routed.departmentIds,
      suggested_task_ids: routed.taskIds,
      suggested_title: routed.title,
      suggested_description: routed.description,
      suggested_tags: routed.tags,
      rule_trace: routed.ruleTrace,
      user_action: "pending",
    });
  }
  const posted = await postAgentMessage({
    conversationId,
    body: row.title,
    agentId,
    isInternalNote,
    kind: "attachment",
    mediaUrl: `assets-v1://${row.id}`,
    mediaType: row.mimeType,
  });
  if (!posted) {
    // The file uploaded but the attachment message did not post. Surface it
    // honestly (§3.4) instead of returning 200 as if the customer received it —
    // the file row persists and is recoverable, but the caller must know the
    // send did not complete.
    return NextResponse.json(
      {
        error:
          "File uploaded but the attachment message could not be posted to the conversation. Please retry sending.",
        file: row,
      },
      { status: 502 }
    );
  }
  // §3.1 chain event.
  await emitAssetEvent({
    companyId,
    actor: agentId,
    kind: "asset.file.uploaded",
    fileId: row.id,
    payload: {
      uploaded_via: "agent_dashboard",
      size_bytes: row.sizeBytes,
      mime_type: row.mimeType,
      classification_lane: "casual",
      linked_conversation_id: conversationId,
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
    id: "care-agent-upload",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;
  // Support-agent gate (not just any authenticated company member): this posts an AGENT-authored
  // attachment message the customer sees, so it must require agent status — mirroring the sibling
  // care/agent/conversations/[id]/messages route (requireCareAgent = is_support_agent OR admin). The
  // earlier getCurrentAuthContext gate mirrored only the sibling's TENANT check, not its AGENT check —
  // letting a non-agent same-company employee speak to a customer as support staff (the A16 apply-here-
  // miss-there class). Within-tenant, so not a data leak, but a real privilege inconsistency.
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // Defense-in-depth + fail-fast: verify the conversation exists and belongs to
  // the caller's company BEFORE doing any upload work — mirroring the sibling
  // care/agent/conversations/[id]/messages guard (§A16). RLS already blocks a
  // cross-tenant write, but without this the route would upload a file + create a
  // classification suggestion + emit an asset event, then have postAgentMessage
  // silently no-op under RLS — persisting a dangling link and a customer message
  // that never posts (a §3.4 dishonest partial: 200 returned, attachment lost).
  const convo = await fetchAgentConversation(id);
  if (!convo || convo.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  // ── Direct-to-storage finalize (JSON branch) ────────────────────────────────
  // The browser already PUT the bytes straight to Storage via /agent-upload/sign,
  // bypassing the ~4.5 MB Vercel body limit. Here we get only { storagePath,
  // filename } and re-read the REAL object before attaching anything.
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      storagePath?: string;
      filename?: string;
      is_internal_note?: boolean;
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
    // legitimate path for this caller starts with their own companyId. Require that prefix so a finalize
    // can't be pointed at ANOTHER company's object — closes cross-company by CONSTRUCTION.
    if (!storagePath.startsWith(`${auth.companyId}/`)) {
      return NextResponse.json(
        { error: "That file doesn't belong to your company." },
        { status: 403 }
      );
    }
    // The client-claimed size/type is untrusted — read the REAL object from storage.
    const info = await getAssetObjectInfo(storagePath);
    if (!info) {
      return NextResponse.json(
        {
          error:
            "The uploaded file wasn't found in storage — please try attaching it again.",
        },
        { status: 404 }
      );
    }
    // Authoritative gate: re-run the SAME allow-list/cap/extension check against the
    // REAL stored size + content-type (not the client's claim).
    const realType = info.contentType || "application/octet-stream";
    const v = validateUploadCandidate({
      sizeBytes: info.sizeBytes,
      mimeType: realType,
      filename,
      uploadedVia: "agent_dashboard",
    });
    if (!v.ok) {
      return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
    }
    return attachAgentFile({
      companyId: auth.companyId,
      agentId: auth.agentId,
      conversationId: id,
      storagePath,
      mimeType: realType,
      sizeBytes: info.sizeBytes,
      filename,
      isInternalNote: body?.is_internal_note === true,
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
  const isInternalNote = form.get("is_internal_note") === "1";
  const v = validateUploadCandidate({
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    // Wire the BLOCKED_EXTENSIONS check (Audit F2 / security 2026-07-09): the
    // browser MIME is spoofable, so the extension block-list is the intended
    // defense-in-depth. Same class as the customer upload route — both call
    // sites skipped filename, so the tested extension guard never fired.
    filename: file.name,
    uploadedVia: "agent_dashboard",
  });
  if (!v.ok) {
    return NextResponse.json(
      { error: v.detail, reason: v.reason },
      { status: 400 }
    );
  }

  // Audit 2026-06-26 (H1): C.A.R.E uploads are ALWAYS linked to the
  // conversation (linked_conversation_id = id below), so they have a
  // designated purpose by the uniform cap rule and must NOT be
  // cap-blocked. (countPurposelessUploadsToday now excludes
  // context-linked files, so these also stop inflating any other
  // surface's count.)
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    companyId: auth.companyId,
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
    console.error(`[care.agent-upload] storage failed conv=${id}: ${up.error}`);
    return NextResponse.json(
      { error: "Couldn't save the file right now — please try again in a moment." },
      { status: 500 }
    );
  }
  return attachAgentFile({
    companyId: auth.companyId,
    agentId: auth.agentId,
    conversationId: id,
    storagePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    filename: file.name,
    isInternalNote,
  });
}
