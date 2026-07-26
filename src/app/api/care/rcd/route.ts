import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/rcd — list the tenant's captured RCD (Raw Conversation Data) conversations,
 * most recent first, for the RCD panel in the C.A.R.E app. Spec:
 * docs/feature-specs/RCD-RAW-CONVERSATION-DATA.md.
 *
 * Session-authed (requireCareAgent); reads through the RLS client, so the tenant SELECT
 * policy (0194) scopes rows to the caller's company. DEGRADE (A34): if 0194 isn't applied,
 * the table is missing and we return an empty list (the panel shows an empty state), never a 500.
 */

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("care_rcd_conversations")
    .select("id, channel, source_url, message_count, captured_at, captured_by")
    .order("captured_at", { ascending: false })
    .limit(100);

  if (error) {
    // Missing table (0194 unapplied) or any read error → empty, so the panel degrades gracefully.
    // Log it so a REAL read error is distinguishable from a genuinely-empty list in the server logs
    // (now that 0194 is applied, the missing-table case is moot and any error here is worth seeing).
    console.error("[rcd list] read failed:", error);
    return NextResponse.json({ conversations: [] });
  }

  const conversations = data ?? [];

  // A first-message PREVIEW so the agent can tell multiple same-channel captures apart at a glance
  // (a plain list of "WhatsApp · N messages" is indistinguishable). ONE batched query for seq 0 of
  // every listed conversation — not N+1. Best-effort: on any error the previews are simply absent.
  let previewByConv = new Map<string, string>();
  if (conversations.length > 0) {
    try {
      const ids = conversations.map((c) => c.id as string);
      const { data: firsts } = await auth.sb
        .from("care_rcd_messages")
        .select("conversation_id, body")
        .in("conversation_id", ids)
        .eq("seq", 0);
      previewByConv = new Map(
        (firsts ?? [])
          .filter((m) => typeof m.body === "string" && (m.body as string).trim())
          .map((m) => [m.conversation_id as string, (m.body as string).trim().slice(0, 140)])
      );
    } catch {
      /* previews are optional */
    }
  }

  return NextResponse.json({
    conversations: conversations.map((c) => ({ ...c, preview: previewByConv.get(c.id as string) ?? null })),
  });
}
