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
  const row = await createFileRecord({
    companyId: auth.companyId,
    uploaderId: auth.userId,
    customerSessionToken: null,
    storagePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    originalFilename: file.name,
    title: file.name,
    description: null,
    accessRole: "everyone",
    uploadedVia: "agent_dashboard",
    linkedConversationId: id,
  });
  if (!row) {
    return NextResponse.json(
      { error: "File row write failed." },
      { status: 500 }
    );
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
  return NextResponse.json({ file: row });
}
