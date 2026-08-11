import { NextRequest, NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAgentConversation } from "@/lib/data/care";
import { mintCareUploadTarget } from "@/lib/care/uploadSign";

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

  // Shared validate → mint → response tail (agent_dashboard: images/pdf/docs, 25 MB). The requireCareAgent +
  // company-match gate above is the security boundary; the helper only mints under auth.companyId (server-
  // derived) and never echoes a raw backend string (CWE-209).
  return mintCareUploadTarget({
    req,
    companyId: auth.companyId,
    uploadedVia: "agent_dashboard",
    logTag: "care.agent-upload/sign",
  });
}
