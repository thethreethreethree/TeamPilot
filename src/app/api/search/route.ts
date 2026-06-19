import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/search?q=...
 *
 * Conversation Search v1 — single search box across:
 *   • files (title + description)
 *   • chat_messages (body)
 *   • support_messages (body, excluding internal notes)
 *
 * Results grouped by type. RLS enforces company isolation and
 * file access roles. Per founder red-pen 2026-06-19.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "search",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({
      files: [],
      chatMessages: [],
      supportMessages: [],
    });
  }
  const sb = await createClient();
  const term = `%${q}%`;

  // Files — ILIKE on title/description (RLS handles visibility)
  const filesPromise = sb
    .from("files")
    .select(
      "id, title, description, classification_lane, mime_type, created_at"
    )
    .is("deprecated_at", null)
    .or(`title.ilike.${term},description.ilike.${term}`)
    .order("created_at", { ascending: false })
    .limit(20);

  // Chat messages — body match
  const chatPromise = sb
    .from("chat_messages")
    .select("id, topic_id, body, author_id, created_at")
    .ilike("body", term)
    .eq("kind", "message")
    .order("created_at", { ascending: false })
    .limit(20);

  // Support messages — body match (visible-only)
  const supportPromise = sb
    .from("support_messages")
    .select("id, conversation_id, body, author_type, created_at")
    .ilike("body", term)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const [files, chats, supports] = await Promise.all([
    filesPromise,
    chatPromise,
    supportPromise,
  ]);

  return NextResponse.json({
    files: files.data ?? [],
    chatMessages: chats.data ?? [],
    supportMessages: supports.data ?? [],
  });
}
