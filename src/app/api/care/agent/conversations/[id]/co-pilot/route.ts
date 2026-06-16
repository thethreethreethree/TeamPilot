import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAgentConversation,
  fetchEnrichedConversation,
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

  const productContext = getProductContextForTenant(enriched.companyId);

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

After the draft, on a separate line starting with "===REASONING===", write 1-2 sentences explaining (for the agent, NOT the customer) which communication move you used and why. Examples:
  - "Led with acknowledgment because the customer explicitly named frustration."
  - "Stayed concise and direct because the customer's last message was terse."
  - "Offered a hand-off because the question requires account-specific data I don't have."

Format strictly:
<draft text>
===REASONING===
<one or two sentences>

Product context the customer is reaching out about:
${productContext}`;

  const userMessage = `Conversation so far:
${turns}

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

  return NextResponse.json({ draft, reasoning });
}
