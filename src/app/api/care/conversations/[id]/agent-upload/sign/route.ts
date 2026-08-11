import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAgentConversation } from "@/lib/data/care";
import {
  createSignedUploadTarget,
  validateUploadCandidate,
  ASSETS_BUCKET,
} from "@/lib/storage/assets";

/**
 * POST /api/care/conversations/[id]/agent-upload/sign
 *
 * Mints a SIGNED UPLOAD target so the agent's browser uploads the attachment
 * DIRECT to Storage, bypassing the ~4.5 MB Vercel serverless request-body limit
 * (src/lib/storage/assets.ts:307) that silently killed any attachment above
 * ~4.5 MB on the multipart /agent-upload path (25 MB advertised cap). The client
 * then PUTs the bytes with this token and POSTs { storagePath, filename } to
 * /agent-upload (JSON branch), which re-reads the REAL object and attaches it.
 * Mirrors the proven Sales-Coach upload-recording/sign endpoint.
 *
 * Auth mirrors the multipart /agent-upload route EXACTLY: requireCareAgent
 * (is_support_agent OR admin) + the conversation must belong to the caller's
 * company — so the sign step is no weaker a gate than the finalize.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limited = rateLimit(req, {
    id: "care-agent-upload-sign",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // Verify the conversation exists and belongs to the caller's company BEFORE
  // minting a target — mirrors the multipart route's fail-fast guard (§A16).
  const convo = await fetchAgentConversation(id);
  if (!convo || convo.conversation.companyId !== auth.companyId) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
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
  // enforces (agent_dashboard: images/pdf/docs, 25 MB). Client-claimed size/type
  // is untrusted — this is a fast reject; the /agent-upload finalize re-validates
  // the REAL stored object before creating any record (the authoritative gate).
  const v = validateUploadCandidate({
    sizeBytes,
    mimeType,
    filename,
    uploadedVia: "agent_dashboard",
  });
  if (!v.ok) {
    return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
  }

  const target = await createSignedUploadTarget({
    companyId: auth.companyId,
    fileId: randomUUID(),
    originalFilename: filename,
  });
  if (!target.ok) {
    // Log the raw cause; return a generic message (CWE-209 — don't echo the backend string).
    // eslint-disable-next-line no-console
    console.error(`[care.agent-upload/sign] target mint failed conv=${id}: ${target.error}`);
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
