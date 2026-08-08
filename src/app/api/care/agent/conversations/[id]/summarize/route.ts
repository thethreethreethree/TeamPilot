import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  fetchAgentConversation,
  findSimilarResolutions,
  formatVisibleThreadForPrompt,
} from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { getExperienceMode } from "@/lib/experience/mode";
import { SUMMARIZE_SYSTEM } from "@/lib/care/toolPrompts";

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
 *
 * The system prompt now lives in @/lib/care/toolPrompts (SUMMARIZE_SYSTEM) so the browser-extension
 * summarize endpoint runs the identical prompt — no drift between the two surfaces (§3.4).
 */
const SYSTEM = SUMMARIZE_SYSTEM;

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Unmetered LLM endpoint (audit 2026-07-06, A13/A21). Per-agent cap.
  const limited = rateLimit(req, {
    id: "care-summarize",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

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
  if (!auth.companyId || detail.conversation.companyId !== auth.companyId) {
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

  // Shared thread formatter (A13 author-once) — same "Role: body" transcript the Dissect
  // routes use. `visible` is kept below for the prior-resolutions match.
  const turns = formatVisibleThreadForPrompt(detail.messages);

  const productContext = await getProductContextForTenant(
    detail.conversation.companyId
  );

  try {
    // §3.4 + TT.md A21: route through Brain (pass companyId)
    // so the §3.4 control window applies. During month-1 the
    // agent reads the thread themselves — same honesty as the
    // rest of the System.
    // The summary is AGENT-FACING (the agent reads it), so it simplifies for a
    // Standard-mode agent (0110 / §A17 — unlike the co-pilot reply, which is
    // customer-facing and must NOT).
    const experienceMode = await getExperienceMode(auth.sb, auth.agentId);
    const r = await generateCareReply({
      companyId: detail.conversation.companyId,
      systemPrompt: SYSTEM,
      userMessage: `Product context the agent is grounded in:\n${productContext}\n\nConversation:\n${turns}\n\nWrite the summary.`,
      experienceMode,
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

    // Per TT.md A21 audit (2026-06-18) MED finding — until this, the
    // C.A.R.E summary was a standalone read with no §3.6 make-learning-
    // visible parallel to chat's similar-topics surface. Now we also
    // surface up to 3 prior held resolutions whose issue_summary
    // matches the current customer's recent messages. The agent sees
    // "we've handled this kind of issue 3 times before" alongside
    // the System's read, so the institutional memory is visible
    // during summary — not just during drafting.
    const customerMessages = visible
      .filter((m) => m.authorType === "customer")
      .slice(-3)
      .map((m) => m.body)
      .join(" ");
    const keywords = extractKeywords(customerMessages);
    const priorSimilar =
      keywords.length > 0
        ? await findSimilarResolutions({
            companyId: detail.conversation.companyId,
            searchTerms: keywords,
            excludeConversationId: id,
            limit: 3,
          })
        : [];
    const summary = r.text.trim();
    // Empty text WITHOUT suppression is a model failure, not the control-window no-summary (handled above).
    // Returning { summary: "" } 200 would show the agent a blank summary as if the thread has nothing to read
    // — the §3.4 false-empty. Fail loud so they retry (mirrors the extension summarize + copilot/formulate).
    if (!summary) {
      console.error("[care/agent/summarize] empty summary from model (not suppressed)");
      return NextResponse.json({ error: "Couldn't generate a summary right now." }, { status: 502 });
    }
    return NextResponse.json({
      summary,
      priorSimilar: priorSimilar.map((p) => ({
        id: p.id,
        issueSummary: p.issueSummary,
        category: p.category,
      })),
    });
  } catch (err) {
    // Surface the REAL provider error instead of swallowing it (2026-07-25).
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[care.summarize] generation failed:", detail, err);
    return NextResponse.json(
      { error: "Couldn't generate a summary right now.", detail },
      { status: 502 }
    );
  }
}

// Minimal keyword extractor — same shape as the Read Phase one.
// Sprint 6 swaps both for embeddings.
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "for", "on", "in", "of",
  "to", "with", "without", "have", "has", "had", "is", "are", "was",
  "were", "be", "been", "being", "do", "does", "did", "this", "that",
  "these", "those", "i", "me", "my", "you", "your", "we", "us", "our",
  "they", "them", "their", "it", "its", "as", "at", "from", "by",
  "about", "what", "when", "where", "why", "how", "if", "so", "just",
  "can", "could", "would", "should", "will", "shall", "may", "might",
  "must", "any", "all", "some", "no", "not", "than", "then", "now",
]);
function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  return Array.from(new Set(tokens)).slice(0, 6);
}
