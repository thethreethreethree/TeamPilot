import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAgentConversation,
  fetchEnrichedConversation,
  findSimilarResolutions,
} from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";

/**
 * POST /api/care/agent/conversations/[id]/co-pilot
 *
 * AI Co-Pilot for agents. Drafts a reply using the Coach
 * communication discipline (warm, resolution-centered, observation-
 * based) PLUS surfaces the internal reasoning to the agent — which
 * communication move it's making and why.
 *
 * The "reasoning" surface here is INTERNAL ONLY. It never appears
 * in the message the customer receives. The customer-facing reply
 * stays plain prose; the reasoning is for the agent's learning
 * (and per §A18 — agent grows over time as they internalize what
 * the Co-Pilot is doing).
 *
 * Returns:
 *   { draft: string, reasoning: string }
 *
 * The agent reviews the draft, edits as needed, and sends through
 * the normal agent reply endpoint.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json({ error: "Care is agent-only." }, { status: 403 });
  }

  const enriched = await fetchEnrichedConversation(id);
  const detail = await fetchAgentConversation(id);
  if (!enriched || !detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  // Last 12 visible turns for context.
  const turns = detail.messages
    .filter((m) => !m.isInternalNote)
    .slice(-12)
    .map((m) => {
      const role =
        m.authorType === "customer"
          ? "Customer"
          : m.authorType === "agent"
            ? "Agent (you, earlier)"
            : m.authorType === "ai"
              ? "AI (earlier auto-reply)"
              : "System";
      return `${role}: ${m.body}`;
    })
    .join("\n");

  // §A16 composition — read the most recent Coach grade on an
  // agent message in this thread. If Coach flagged the prior
  // reply as needs_guidance, the Co-Pilot's next draft MUST
  // incorporate that feedback. Without this read, two AI tools
  // operate on the same conversation surface and contradict each
  // other — Coach says "your last reply read as dismissive,"
  // Co-Pilot drafts a new reply with the same shape because it
  // never saw Coach's finding. A16 names this failure exactly.
  const mostRecentGradedAgentReply = detail.messages
    .filter((m) => m.authorType === "agent" && !m.isInternalNote)
    .reverse()
    .find((m) => m.coachGrade && m.coachGrade !== "withheld");
  const coachContext =
    mostRecentGradedAgentReply &&
    mostRecentGradedAgentReply.coachGrade === "needs_guidance" &&
    mostRecentGradedAgentReply.coachReasonInternal
      ? {
          grade: mostRecentGradedAgentReply.coachGrade,
          reason: mostRecentGradedAgentReply.coachReasonInternal,
          flaggedReplyBody: mostRecentGradedAgentReply.body,
        }
      : null;

  const productContext = await getProductContextForTenant(enriched.companyId);

  // Pull similar past resolutions so the Co-Pilot can draw on the
  // company's institutional memory. The reasoning surface will cite
  // which precedent it leaned on, so the agent can see whether the
  // System is generalizing from real prior work or guessing.
  const customerLastMessages = detail.messages
    .filter((m) => m.authorType === "customer")
    .slice(-3)
    .map((m) => m.body)
    .join(" ");
  const searchTerms = extractKeywords(customerLastMessages);
  const precedents = await findSimilarResolutions({
    companyId: enriched.companyId,
    searchTerms,
    excludeConversationId: id,
    limit: 3,
  });

  // Two-pass: ask for draft + reasoning in a single call but
  // separated by an explicit marker we split on.
  const SYSTEM = `You are the AI Co-Pilot for a support agent. Draft the agent's NEXT REPLY to a customer.

Draft the reply the way a calm, attentive human agent would write it:
  - Plain prose, no markdown
  - Acknowledge what the customer said briefly
  - Answer the question OR honestly say what you don't know and offer the next move
  - Don't pad, don't use corporate filler ("we appreciate your patience" etc.)
  - 1-4 sentences typical
  - End with a clear next step OR a warm hand-off if you can't help

If the PRIOR RESOLUTIONS below describe what worked for similar past customers, lean on them — your draft should apply the same approach unless this customer's situation is meaningfully different. The reasoning line should name which precedent you used.

After the draft, on a separate line starting with "===REASONING===", write 1-2 sentences explaining (for the agent, NOT the customer) which communication move you used and which precedent (if any) you drew on. Examples:
  - "Applied the [refund within 7 days] precedent — same shape as the prior case from 4 days ago."
  - "No close precedent. Led with acknowledgment because the customer named frustration."
  - "Offered a hand-off because the question requires account-specific data I don't have."

Format strictly:
<draft text>
===REASONING===
<one or two sentences>

Product context the customer is reaching out about:
${productContext}${
    coachContext
      ? `

COACH FEEDBACK ON THE AGENT'S PRIOR REPLY (internal — do NOT mention this to the customer in any form):
The agent's previous reply was flagged needs_guidance by the Coach surface. Reason: "${coachContext.reason}"

When drafting this next reply, incorporate the Coach feedback. The reasoning line at the bottom should briefly name how you addressed it (e.g., "Addressed the dismissive read by acknowledging the customer's frustration first"). Do not write the Coach reason or the word "Coach" anywhere in the draft itself — only the agent sees the reasoning line.`
      : ""
  }`;

  const precedentBlock =
    precedents.length > 0
      ? `\n\nPRIOR RESOLUTIONS from similar past customers (each starts with "what worked"):\n${precedents
          .map(
            (p, i) =>
              `${i + 1}. [${p.category ?? "uncategorized"}] Issue: ${p.issueSummary}\n   Worked: ${p.whatWorked}`
          )
          .join("\n")}`
      : "";

  const userMessage = `Conversation so far:
${turns}${precedentBlock}

Draft the next reply.`;

  let raw = "";
  try {
    const r = await generateCareReply({
      systemPrompt: SYSTEM,
      userMessage,
    });
    raw = r.text;
  } catch {
    return NextResponse.json(
      {
        error:
          "The Co-Pilot couldn't draft a reply right now. Type your own and we'll learn from it.",
      },
      { status: 502 }
    );
  }

  const marker = "===REASONING===";
  const idx = raw.indexOf(marker);
  const draft = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const reasoning = idx >= 0 ? raw.slice(idx + marker.length).trim() : "";

  return NextResponse.json({
    draft,
    reasoning,
    precedentsUsed: precedents.length,
  });
}

// Local keyword extraction — mirrors the Read Phase logic. Sprint 6
// swaps both for embeddings.
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
  return Array.from(new Set(tokens)).slice(0, 8);
}
