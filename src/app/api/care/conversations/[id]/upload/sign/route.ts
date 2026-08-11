import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { getCareConversationByToken } from "@/lib/data/care";
import { mintCareUploadTarget } from "@/lib/care/uploadSign";

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

  // Shared validate → mint → response tail (customer_widget: images/pdf, 10 MB). The auth (token) +
  // conversation gate above is the security boundary; the helper only mints under conv.companyId (server-
  // derived) and never echoes a raw backend string to this PUBLIC endpoint (CWE-209).
  return mintCareUploadTarget({
    req,
    companyId: conv.companyId,
    uploadedVia: "customer_widget",
    logTag: "care.upload/sign",
  });
}
