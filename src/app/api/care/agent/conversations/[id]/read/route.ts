import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAgentConversation,
  fetchCustomerPriorConversations,
  fetchEnrichedConversation,
  findSimilarResolutions,
  markReadingComplete,
} from "@/lib/data/care";

/**
 * GET /api/care/agent/conversations/[id]/read
 *
 * The Read Phase — §0 Understanding Gate applied to support.
 * Before the agent drafts a reply, the System assembles:
 *   - The customer's prior conversations (have they been here?)
 *   - The 3-5 most-similar past resolutions from other customers
 *     (what worked last time for the same kind of issue?)
 *   - The current conversation's recent message tail for context
 *
 * No competitor surfaces this end-to-end. Most either let the AI
 * answer in a vacuum or hand the agent a blank reply box.
 *
 * POST /api/care/agent/conversations/[id]/read
 * Marks the Read Phase complete — the agent has reviewed the
 * context. Sets reading_complete_at on the conversation row.
 */

async function requireAgent() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent || !profile?.company_id) {
    return { error: "Agent only.", status: 403 } as const;
  }
  return { agentId: auth.user.id, companyId: profile.company_id };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireAgent();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const conv = await fetchEnrichedConversation(id);
  const detail = await fetchAgentConversation(id);
  if (!conv || !detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  // Customer history (only if we have an identified customer)
  let priorConversations: Awaited<
    ReturnType<typeof fetchCustomerPriorConversations>
  > = [];
  if (conv.customerId) {
    priorConversations = await fetchCustomerPriorConversations({
      customerId: conv.customerId,
      excludeConversationId: id,
    });
  }

  // Similar past resolutions — pull keywords from customer's recent
  // messages (the actual issue text) and search the resolutions
  // index. Sprint 5 will swap this for embeddings.
  const customerMessages = detail.messages
    .filter((m) => m.authorType === "customer")
    .slice(-3)
    .map((m) => m.body)
    .join(" ");
  const keywords = extractKeywords(customerMessages);
  const similarResolutions = await findSimilarResolutions({
    companyId: auth.companyId,
    searchTerms: keywords,
    excludeConversationId: id,
    limit: 5,
  });

  return NextResponse.json({
    customerHasHistory: priorConversations.length > 0,
    priorConversations,
    similarResolutions,
    keywords,
    readingCompleteAt: conv.readingCompleteAt ?? null,
  });
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireAgent();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await markReadingComplete(id);
  return NextResponse.json({ ok: true });
}

/**
 * Extract keywords from a customer message blob. Keeps tokens
 * that are reasonably-long, lowercased, and not in a small stoplist.
 * Crude but effective for v1; embeddings come in Sprint 5.
 */
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
  // Dedupe, keep order
  return Array.from(new Set(tokens)).slice(0, 8);
}

