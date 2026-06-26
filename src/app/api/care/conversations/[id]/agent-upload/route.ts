import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { createFileRecord } from "@/lib/data/files";
import { postAgentMessage } from "@/lib/data/care";
import {
  buildStoragePath,
  uploadAssetBytes,
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
 *   • multipart upload to Supabase Storage
 *   • files row creation (linked to this conversation)
 *   • support_messages attachment-kind row posting
 *
 * Single endpoint = single network call from the composer.
 * 25 MB agent cap, agent allow list (images / pdf / docs /
 * audio). RLS still enforces company isolation at the row
 * level.
 */
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
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
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
  const isInternalNote = form.get("is_internal_note") === "1";
  const v = validateUploadCandidate({
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
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
  // cap-blocked. The previous code treated them as "always casual ->
  // always counted," which created the dead-end the founder hit:
  // an agent at the cap could not attach a file to a customer reply
  // even though that file is inherently purposeful. Removing the cap
  // block here makes C.A.R.E consistent with every other
  // context-linked upload surface. (countPurposelessUploadsToday now
  // excludes context-linked files, so these also stop inflating any
  // other surface's count.)
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
    return NextResponse.json(
      { error: `Upload failed: ${up.error}` },
      { status: 500 }
    );
  }
  // Auto-route the upload via deterministic rules. Per §A11 —
  // System counts derived from facts (linked conversation,
  // uploader department, filename, support-department lookup).
  const routed = await autoRouteFile({
    uploaderId: auth.userId,
    companyId: auth.companyId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    linkedConversationId: id,
    source: "care_agent",
  });

  let row;
  try {
    row = await createFileRecord({
      companyId: auth.companyId,
      uploaderId: auth.userId,
      customerSessionToken: null,
      storagePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      originalFilename: file.name,
      title: routed.title || file.name,
      description: routed.description,
      accessRole: "everyone",
      uploadedVia: "agent_dashboard",
      linkedConversationId: id,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `File row write failed: ${detail}` },
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
  await postAgentMessage({
    conversationId: id,
    body: row.title,
    agentId: auth.userId,
    isInternalNote,
    kind: "attachment",
    mediaUrl: `assets-v1://${row.id}`,
    mediaType: row.mimeType,
  });
  // §3.1 chain event.
  await emitAssetEvent({
    companyId: auth.companyId,
    actor: auth.userId,
    kind: "asset.file.uploaded",
    fileId: row.id,
    payload: {
      uploaded_via: "agent_dashboard",
      size_bytes: row.sizeBytes,
      mime_type: row.mimeType,
      classification_lane: "casual",
      linked_conversation_id: id,
    },
  });
  return NextResponse.json({ file: row });
}
