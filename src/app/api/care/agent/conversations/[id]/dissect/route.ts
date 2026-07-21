import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAgentConversation, formatVisibleThreadForPrompt } from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { generateConversationDissect } from "@/lib/dissect/engine";

/**
 * POST /api/care/agent/conversations/[id]/dissect
 *
 * "Dissect a Conversation" (founder 2026-07-21) brought into the C.A.R.E agent inbox — the
 * same engine as the standalone /dashboard/dissect page, run on THIS support conversation so
 * an agent can diagnose it in place instead of copy-pasting it out. Where Summarize gives the
 * agent a fast catch-up read, Dissect gives them the problem-solving lens: the core problem,
 * evidence quoted from the thread, the root cause (§0), the outside view (§1.3), and angles to
 * CONSIDER — never prescriptions (§3.3 don't overtake). It ends on a guiding question so the
 * AGENT renders the verdict (§A11).
 *
 * EPHEMERAL — nothing is persisted; the result lives in the panel's state. Agent-authed +
 * rate-limited + company-scoped. Degrades honestly (§3.4): a thin thread returns
 * hasSignal:false, never a fabricated problem — the engine's own guard. Routes the LLM cost
 * through the tenant's company (so the §3.4 Brain control window applies, same as the
 * standalone Dissect).
 */

// LLM route: longer serverless budget than Vercel's short default.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "care-dissect",
    windowMs: 60_000,
    max: 15,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  // Company scope — same guard as Summarize; RLS already scopes, this is defense in depth.
  if (!auth.companyId || detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  // Only the real back-and-forth feeds the dissection — internal notes are the agent's own
  // scratch, not part of the conversation being diagnosed. Shared formatter so the follow-up
  // (dissect/ask) grounds in the IDENTICALLY-shaped thread (A14/A16).
  const sourceText = formatVisibleThreadForPrompt(detail.messages);

  // The engine guards thin input itself (returns hasSignal:false when there's too little to
  // diagnose honestly), so no separate short-circuit here — one honest path.
  const dissect = await generateConversationDissect({
    companyId: detail.conversation.companyId,
    sourceText,
  });

  return NextResponse.json({ dissect });
}
