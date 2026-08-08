import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  fetchAgentConversation,
  fetchEnrichedConversation,
  findSimilarResolutions,
} from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { copilotModeInstruction, lastSpeakerFromAuthorType } from "@/lib/care/copilotMode";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { SERVICE_PHILOSOPHY } from "@/lib/care/servicePhilosophy";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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
// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Unmetered LLM endpoint (audit 2026-07-06, A13/A21 — 27 coach routes + these
  // must all rate-limit). Per-agent cap so a stuck retry can't spin cost.
  const limited = rateLimit(req, {
    id: "care-copilot",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const enriched = await fetchEnrichedConversation(id);
  const detail = await fetchAgentConversation(id);
  if (!enriched || !detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  // Defense-in-depth: explicit company match check.
  if (!auth.companyId || detail.conversation.companyId !== auth.companyId) {
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

  // Response-MODE selection (founder request 2026-07-23 — parity with the extension Co-Pilot, Lesson 5
  // / A21). Unlike the extension (which must guess from scraped text), the in-app Co-Pilot knows who
  // spoke last DETERMINISTICALLY from authorType. When our side sent the last message — the agent, OR
  // an AI auto-reply on the agent's behalf — the customer hasn't replied, so a "reply" would answer our
  // own words: switch to follow-up mode. Only "customer" last → reply. Anything else → unknown (the
  // model determines it and defaults to reply, so no regression). Reuses copilotMode.ts (same helper).
  const visibleTurns = detail.messages.filter((m) => !m.isInternalNote);
  const lastTurn = visibleTurns[visibleTurns.length - 1];
  const lastSpeaker = lastSpeakerFromAuthorType(lastTurn?.authorType);
  const modeInstruction = copilotModeInstruction(lastSpeaker, "the agent");

  // Two-pass: ask for draft + reasoning in a single call but
  // separated by an explicit marker we split on.
  const SYSTEM = `You are the AI Co-Pilot for a support agent. Draft the agent's NEXT MESSAGE to a customer. Whether that message is a reply to the customer or a follow-up from the agent is set by the RESPONSE MODE below — follow it.

${modeInstruction}

Draft the message the way a calm, attentive human agent would write it:
  - Plain prose, no markdown
  - When replying, acknowledge what the customer said briefly
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
    // §3.4 + TT.md A21: route through Brain (pass companyId)
    // so the §3.4 control window applies. Co-Pilot is the
    // most-AI-active C.A.R.E surface — without this gate it
    // would always draft from day 1, contradicting the
    // "no fixed day-one behavior" rule. During month-1 the
    // agent drafts solo and the team's baseline is captured.
    const r = await generateCareReply({
      companyId: enriched.companyId,
      // Fence the customer conversation as untrusted data (§A26 class sweep — same as the extension tools).
      systemPrompt: SYSTEM + SERVICE_PHILOSOPHY + CONVERSATION_IS_DATA,
      userMessage,
    });
    if (r.suppressed) {
      return NextResponse.json(
        {
          suppressed: true,
          reason: r.reason,
          message:
            "Co-Pilot is in §3.4 control window — type your own draft and the System will learn from it.",
        },
        { status: 200 }
      );
    }
    raw = r.text;
  } catch (err) {
    // Surface the REAL provider error instead of swallowing it (2026-07-25: "Co-pilot
    // couldn't draft" was opaque — the actual cause, e.g. an LLM provider/auth/balance
    // error, was lost). Log for the server + return `detail` so the agent sees the cause.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[care.co-pilot] generation failed:", detail, err);
    return NextResponse.json(
      {
        error:
          "The Co-Pilot couldn't draft a reply right now. Type your own and we'll learn from it.",
        detail,
      },
      { status: 502 }
    );
  }

  const marker = "===REASONING===";
  const idx = raw.indexOf(marker);
  const draft = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const reasoning = idx >= 0 ? raw.slice(idx + marker.length).trim() : "";

  // Guard an empty draft (e.g. the model emitted the ===REASONING=== marker first, or returned blank) — never
  // render { draft: "" } as if the Co-Pilot drafted nothing. Fail loud so the agent retries (§3.4; mirrors the
  // extension co-pilot's if(!reply) guard).
  if (!draft) {
    console.error("[care.co-pilot] empty draft after parsing (marker-first or blank generation)");
    return NextResponse.json(
      { error: "The Co-Pilot couldn't draft a reply right now. Type your own and we'll learn from it." },
      { status: 502 }
    );
  }

  // Per TT.md A21 audit (2026-06-18) MED finding — until this,
  // we returned only `precedentsUsed: precedents.length` (a count).
  // The agent had no way to see WHICH past resolutions the System
  // leaned on. §3.6 make-learning-visible was violated — the
  // institutional memory was being consulted invisibly. Now we
  // return a trimmed precedent list (id + summary + category) so
  // the UI can surface "Drew on: refund within 7 days (4 days
  // ago)" etc. Agents can verify the precedent is real (drill-
  // through to the resolution) and judge whether the generalization
  // is fair (§3.3 guide-don't-overtake).
  return NextResponse.json({
    draft,
    reasoning,
    precedents: precedents.map((p) => ({
      id: p.id,
      issueSummary: p.issueSummary,
      category: p.category,
      whatWorked: p.whatWorked,
    })),
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
