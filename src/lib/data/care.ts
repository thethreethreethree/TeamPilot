import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * ELOSTATE Care — data layer.
 *
 * Two access patterns coexist:
 *  - Customer-side (no auth) → uses service-role on the server,
 *    scopes by session_token. The widget never touches the DB
 *    directly; everything routes through API handlers in
 *    src/app/api/care/*.
 *  - Agent-side (authenticated) → uses the standard server
 *    client; RLS policies from 0034 enforce company-scoping.
 *
 * Keep these functions small and focused. The route handlers do
 * the AI-call orchestration; this file is pure data access.
 */

export type SupportConversation = {
  id: string;
  companyId: string;
  customerId: string | null;
  sessionToken: string;
  status:
    | "open"
    | "in_conversation"
    | "awaiting_customer"
    | "resolved"
    | "closed";
  assignedAgentId: string | null;
  source: "web_widget" | "email" | "embedded_widget";
  aiResponding: boolean;
  subject: string | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  authorType: "customer" | "ai" | "agent" | "system";
  authorId: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
};

function mapConversation(row: Record<string, unknown>): SupportConversation {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    customerId: (row.customer_id as string | null) ?? null,
    sessionToken: row.session_token as string,
    status: row.status as SupportConversation["status"],
    assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
    source: row.source as SupportConversation["source"],
    aiResponding: row.ai_responding as boolean,
    subject: (row.subject as string | null) ?? null,
    firstMessageAt: (row.first_message_at as string | null) ?? null,
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    firstResponseAt: (row.first_response_at as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapMessage(row: Record<string, unknown>): SupportMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    authorType: row.author_type as SupportMessage["authorType"],
    authorId: (row.author_id as string | null) ?? null,
    body: row.body as string,
    isInternalNote: row.is_internal_note as boolean,
    createdAt: row.created_at as string,
  };
}

// ─── Customer-side (service-role; no auth) ────────────────────

/**
 * Create a new customer support conversation for a given tenant.
 * Returns the new row including the session_token the widget
 * persists for subsequent requests.
 */
export async function createCareConversation(args: {
  companyId: string;
  source?: "web_widget" | "embedded_widget";
  subject?: string;
}): Promise<SupportConversation | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("support_conversations")
    .insert({
      company_id: args.companyId,
      source: args.source ?? "web_widget",
      subject: args.subject ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[care] createConversation failed", error);
    }
    return null;
  }
  return mapConversation(data);
}

/**
 * Look up a conversation by its session_token. Customer-side
 * route handlers call this on every request to validate the
 * widget's bearer before doing any work.
 */
export async function getCareConversationByToken(
  token: string
): Promise<SupportConversation | null> {
  if (!token) return null;
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("support_conversations")
    .select("*")
    .eq("session_token", token)
    .maybeSingle();
  return data ? mapConversation(data) : null;
}

/**
 * Get the message thread for a conversation, ordered oldest first.
 * Filters out internal notes (those are agent-only — the widget
 * never sees them).
 */
export async function listCareMessagesForCustomer(
  conversationId: string
): Promise<SupportMessage[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapMessage);
}

/**
 * Append a message authored by the customer. The trigger from
 * 0034 stamps first/last_message_at on the conversation row.
 */
export async function postCustomerMessage(args: {
  conversationId: string;
  body: string;
}): Promise<SupportMessage | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("support_messages")
    .insert({
      conversation_id: args.conversationId,
      author_type: "customer",
      body: args.body,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapMessage(data);
}

/**
 * Append an AI-authored reply. Called by the route handler after
 * generateCareReply returns.
 */
export async function postAiMessage(args: {
  conversationId: string;
  body: string;
}): Promise<SupportMessage | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("support_messages")
    .insert({
      conversation_id: args.conversationId,
      author_type: "ai",
      body: args.body,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapMessage(data);
}

/**
 * Flip ai_responding=false when the AI hands off. The next
 * customer message no longer triggers an AI reply; the inbox is
 * the agent's to handle.
 */
export async function markConversationHandedOff(
  conversationId: string
): Promise<void> {
  const sb = createServiceRoleClient();
  await sb
    .from("support_conversations")
    .update({ ai_responding: false })
    .eq("id", conversationId);
}

// ─── Agent-side (authenticated; RLS-scoped) ──────────────────

/**
 * Inbox list for an agent — all conversations in their company.
 * RLS filters by company; we just sort and limit here.
 */
export async function fetchAgentInbox(): Promise<SupportConversation[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);
  return (data ?? []).map(mapConversation);
}

/**
 * Single conversation by id — agent view. Includes internal notes
 * (RLS ensures they only see their own company's).
 */
export async function fetchAgentConversation(
  id: string
): Promise<{
  conversation: SupportConversation;
  messages: SupportMessage[];
} | null> {
  const sb = await createServerClient();
  const { data: c } = await sb
    .from("support_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const { data: msgs } = await sb
    .from("support_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  return {
    conversation: mapConversation(c),
    messages: (msgs ?? []).map(mapMessage),
  };
}

/**
 * Agent claims a conversation: assigns themselves, flips status,
 * stops the AI from auto-responding.
 */
export async function claimConversation(args: {
  conversationId: string;
  agentId: string;
}): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_conversations")
    .update({
      assigned_agent_id: args.agentId,
      ai_responding: false,
      status: "in_conversation",
    })
    .eq("id", args.conversationId);
}

/**
 * Agent posts a reply (or internal note). Internal notes are
 * agent-only — the customer widget never sees them.
 */
export async function postAgentMessage(args: {
  conversationId: string;
  body: string;
  agentId: string;
  isInternalNote?: boolean;
}): Promise<SupportMessage | null> {
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("support_messages")
    .insert({
      conversation_id: args.conversationId,
      author_type: "agent",
      author_id: args.agentId,
      body: args.body,
      is_internal_note: !!args.isInternalNote,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  // After an agent reply, the conversation transitions to
  // 'awaiting_customer' so the inbox surfaces it correctly.
  if (!args.isInternalNote) {
    await sb
      .from("support_conversations")
      .update({ status: "awaiting_customer" })
      .eq("id", args.conversationId);
  }
  return mapMessage(data);
}

/**
 * Agent changes the status of a conversation directly (resolve,
 * close, reopen).
 */
export async function setConversationStatus(args: {
  conversationId: string;
  status: SupportConversation["status"];
}): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_conversations")
    .update({ status: args.status })
    .eq("id", args.conversationId);
}
