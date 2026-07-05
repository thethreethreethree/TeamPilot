import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { getCareConversationByToken } from "@/lib/data/care";
import { signAssetUrl } from "@/lib/storage/assets";

/**
 * GET /api/care/conversations/[id]/file/[fileId]
 *
 * Customer-side signed URL for files attached to THEIR
 * conversation. Authenticated by the widget session token. The
 * file must have linked_conversation_id matching the conversation
 * the session is on — preventing cross-conversation file leaks.
 *
 * Returns { downloadUrl, title, mimeType } so the widget can
 * render an attachment card without a separate metadata round-trip.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await context.params;
  const limited = rateLimit(req, {
    id: "care-file-url",
    windowMs: 60_000,
    max: 120,
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
  // Use admin client path via getFile — RLS would refuse this
  // customer (no auth user). The conversation-id match is our
  // authorization check.
  const file = await getFileForCustomer(fileId, conv.id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const downloadUrl = await signAssetUrl({
    storagePath: file.storagePath,
    expiresInSeconds: 600,
  });
  if (!downloadUrl) {
    return NextResponse.json({ error: "Failed to sign URL." }, { status: 500 });
  }
  return NextResponse.json({
    downloadUrl,
    title: file.title,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });
}

async function getFileForCustomer(
  fileId: string,
  conversationId: string
): Promise<
  | { storagePath: string; title: string; mimeType: string; sizeBytes: number }
  | null
> {
  // Use the admin client so the customer (no auth.users row)
  // can resolve the file. Authorization is enforced by:
  //   1. linked_conversation_id matches their session's
  //      conversation (prevents cross-conversation file leaks)
  //   2. access_role MUST be 'everyone' — customers cannot
  //      download admins-only / ceo_admins / specific_people
  //      files even if the agent attached them. Per the
  //      inspection closure 2026-06-19-asset-system-v1 Finding 3.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const sb = createAdminClient();
  const { data } = await sb
    .from("files")
    .select("storage_path, title, mime_type, size_bytes, linked_conversation_id, access_role")
    .eq("id", fileId)
    .is("deprecated_at", null)
    .maybeSingle();
  if (!data) return null;
  if (data.linked_conversation_id !== conversationId) return null;
  // Customer-side: only 'everyone' files are downloadable. An
  // agent who marks a file admins-only and attaches it to the
  // conversation is signaling internal-only — the customer must
  // not be able to download it via the inline attachment link.
  if (data.access_role !== "everyone") return null;
  return {
    storagePath: data.storage_path as string,
    title: data.title as string,
    mimeType: data.mime_type as string,
    sizeBytes: data.size_bytes as number,
  };
}
