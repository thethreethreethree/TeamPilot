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
    return NextResponse.json({ conversations: [] });
  }

  return NextResponse.json({ conversations: data ?? [] });
}
