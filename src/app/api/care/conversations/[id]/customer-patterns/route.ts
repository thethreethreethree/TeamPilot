import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchAgentConversation, fetchCustomerPatterns } from "@/lib/data/care";
import { aggregateCustomerPatterns } from "@/lib/care/customerPatterns";

/**
 * GET /api/care/conversations/[id]/customer-patterns
 *
 * Agent-authenticated. Returns COUNTS the System has observed about this conversation's
 * customer across all their conversations (§A11 mirror — counts, never verdicts;
 * threshold-gated per §3.2). Read-only.
 *
 * Tenant-scoped: like decision-seed, fetchAgentConversation bypasses RLS via the service role,
 * so this verifies the conversation belongs to the caller's company before returning anything
 * (cross-tenant id → 404). An anonymous conversation (no linked customer) returns an empty,
 * below-threshold aggregate — honest "not enough data", never an error.
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

  const customerId = data.conversation.customerId;
  if (!customerId) {
    // Anonymous visitor — nothing to aggregate; honest below-threshold result.
    return NextResponse.json(aggregateCustomerPatterns([]));
  }

  const patterns = await fetchCustomerPatterns(auth.companyId, customerId);
  return NextResponse.json(patterns);
}
