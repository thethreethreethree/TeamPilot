import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation } from "@/lib/data/care";
import { buildDecisionSeed } from "@/lib/care/decisionSeed";

/**
 * GET /api/care/conversations/[id]/decision-seed
 *
 * Agent-authenticated. Returns a Decision Dialogue "situation" seed built from a support
 * conversation, for "Open as Decision Dialogue" on the conversation. Read-only — unlike the
 * Read-Phase endpoint, it does NOT mutate reading_complete_at; seeding a decision is not the
 * same act as completing the understanding gate.
 *
 * Tenant-scoped: fetchAgentConversation fetches by id via the service role (bypasses RLS), so
 * this handler MUST verify the conversation belongs to the caller's company before returning
 * its content — otherwise an agent could seed a decision from another tenant's conversation
 * (multi-tenant IDOR). A cross-tenant id returns 404, not 403, so it leaks nothing about
 * whether the id exists.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "No company on profile." }, { status: 403 });
  }

  const data = await fetchAgentConversation(id);
  if (!data || data.conversation.companyId !== auth.companyId) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const seed = buildDecisionSeed(data.conversation, data.messages);
  return NextResponse.json(seed);
}
