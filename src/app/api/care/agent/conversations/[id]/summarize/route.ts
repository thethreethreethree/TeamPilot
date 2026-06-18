import { NextRequest, NextResponse } from "next/server";
import { fetchAgentConversation } from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * POST /api/care/agent/conversations/[id]/summarize
 *
 * Returns the System's read of the conversation so far — a 3-5
 * sentence summary an agent taking over a long thread can read
 * fast. Per §3.3 the summary is framed as the System's READ,
 * confirm-or-correct; it isn't authoritative. The agent renders
 * the verdict.
 *
 * Per §A11 the summary surfaces facts (what was asked, what was
 * tried, what's still open), not verdicts ("the customer is
 * unreasonable" etc.).
 */
const SYSTEM = `You are summarizing a customer support conversation for an agent who is about to step in. Write a 3-5 sentence read of the thread that helps the agent catch up fast.

Cover, in order:
  1. What the customer is asking for / what they're stuck on
  2. What's already been tried or said (briefly)
  3. What's still open or unresolved
  4. If relevant: tone or urgency cues the agent should know about

Constraints:
  - Plain prose, no bullets, no markdown
  - Don't invent details that aren't in the conversation
  - Be specific (names, dates, dollar amounts) when the thread has them
  - Don't editorialize about the customer's character or competence
  - 3-5 sentences total. No fluff.

If the conversation is too short to need a summary (≤2 messages), say so plainly in one sentence.`;

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  if (auth.companyId && detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  const visible = detail.messages.filter((m) => !m.isInternalNote);
  if (visible.length === 0) {
    return NextResponse.json({
      summary: "No messages yet in this conversation.",
    });
  }

  const turns = visible
    .map((m) => {
      const role =
        m.authorType === "customer"
          ? "Customer"
          : m.authorType === "agent"
            ? "Agent"
            : m.authorType === "ai"
              ? "AI"
              : "System";
      return `${role}: ${m.body}`;
    })
    .join("\n");

  const productContext = await getProductContextForTenant(
    detail.conversation.companyId
  );

  try {
    // §3.4 + TT.md A21: route through Brain (pass companyId)
    // so the §3.4 control window applies. During month-1 the
    // agent reads the thread themselves — same honesty as the
    // rest of the System.
    const r = await generateCareReply({
      companyId: detail.conversation.companyId,
      systemPrompt: SYSTEM,
      userMessage: `Product context the agent is grounded in:\n${productContext}\n\nConversation:\n${turns}\n\nWrite the summary.`,
    });
    if (r.suppressed) {
      return NextResponse.json(
        {
          suppressed: true,
          reason: r.reason,
          summary:
            "Summarize is in §3.4 control window — read the thread directly; the System will learn from the team's reads first.",
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ summary: r.text.trim() });
  } catch {
    return NextResponse.json(
      { error: "Couldn't generate a summary right now." },
      { status: 502 }
    );
  }
}
