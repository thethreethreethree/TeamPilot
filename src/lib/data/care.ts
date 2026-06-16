import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";
import { strictMutate } from "@/lib/supabase/strictUpdate";

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
  // §0 Understanding Gate moment for support (0036). Null until
  // the agent has reviewed the Read Phase panel.
  readingCompleteAt: string | null;
  // §1.1 captured outcome category (0036) for pattern detection.
  resolutionOutcomeCategory: string | null;
  createdAt: string;
};

/**
 * Coach v6 count-based output. Per A11 the System counts facts;
 * the agent/leader render the verdict. Shape mirrors
 * src/lib/care/grader.ts CoachCounts; kept local to the data
 * layer to avoid cross-importing server-only code.
 */
export type CoachCountsValue = {
  positive: {
    acknowledged: 0 | 1;
    answered: 0 | 1;
    next_step: 0 | 1;
  };
  risks: {
    unsupported_absolutes: number;
    fabricated_specifics: number;
    empty_filler: number;
  };
  reason_internal: string;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  authorType: "customer" | "ai" | "agent" | "system";
  authorId: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  /** v5 enum, kept for back-compat. New UI reads coachCounts. */
  coachGrade: "productive" | "neutral" | "needs_guidance" | "withheld" | null;
  coachReasonInternal: string | null;
  coachGradedAt: string | null;
  /** Coach v6 count-based rubric. Null when the grader withheld
   *  or the message was graded before migration 0040. */
  coachCounts: CoachCountsValue | null;
  /** A16 direction 2 — Co-Pilot reasoning persisted on the
   *  message when the agent invoked Co-Pilot to draft it. The
   *  grader reads this when scoring to honor deliberate shape
   *  choices. NULL when the agent typed without Co-Pilot. */
  coPilotReasoning: string | null;
  /** Analytics flag — did the agent invoke Co-Pilot during
   *  drafting? Independent of coPilotReasoning (which can be
   *  null even if invoked, if the LLM call failed). */
  coPilotInvoked: boolean;
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
    readingCompleteAt: (row.reading_complete_at as string | null) ?? null,
    resolutionOutcomeCategory:
      (row.resolution_outcome_category as string | null) ?? null,
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
    coachGrade: (row.coach_grade as SupportMessage["coachGrade"]) ?? null,
    coachReasonInternal:
      (row.coach_reason_internal as string | null) ?? null,
    coachGradedAt: (row.coach_graded_at as string | null) ?? null,
    coachCounts: (row.coach_counts as CoachCountsValue | null) ?? null,
    coPilotReasoning: (row.co_pilot_reasoning as string | null) ?? null,
    coPilotInvoked: (row.co_pilot_invoked as boolean | null) ?? false,
  };
}

// ─── Customer-side (service-role; no auth) ────────────────────

/**
 * Count conversations a tenant has created in the current calendar
 * month (UTC). Used for monthly quota enforcement on white-label
 * tenants. Calendar-month boundary (not rolling 30d) is the honest
 * shape for "you bought N conversations / month" — the bucket
 * resets at midnight UTC on the 1st.
 */
export async function countCareConversationsThisMonth(
  companyId: string
): Promise<number> {
  const sb = createServiceRoleClient();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const { count } = await sb
    .from("support_conversations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", monthStart);
  return count ?? 0;
}

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
  await strictMutate(
    sb
      .from("support_conversations")
      .update({
        assigned_agent_id: args.agentId,
        ai_responding: false,
        status: "in_conversation",
      })
      .eq("id", args.conversationId)
      .select("id"),
    { context: "claimConversation" }
  );
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
  /** A16 direction 2 — set when the agent invoked Co-Pilot to
   *  draft this message. Persists alongside the message so the
   *  Coach grader can read it when scoring. */
  coPilotReasoning?: string | null;
  coPilotInvoked?: boolean;
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
      co_pilot_reasoning: args.coPilotReasoning ?? null,
      co_pilot_invoked: !!args.coPilotInvoked,
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
}): Promise<{ id: string; status: string }> {
  const sb = await createServerClient();
  const rows = await strictMutate(
    sb
      .from("support_conversations")
      .update({ status: args.status })
      .eq("id", args.conversationId)
      .select("id, status"),
    { context: `setConversationStatus(${args.status})` }
  );
  return rows[0] as { id: string; status: string };
}

// ─── Operational depth (post-0035) ─────────────────────────────

export type SupportTag = {
  id: string;
  companyId: string;
  name: string;
  color: string;
};

export type SupportCustomer = {
  id: string;
  companyId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  lifetimeValue: number | null;
  signupDate: string | null;
  lastSeenAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ConversationEvent = {
  id: string;
  conversationId: string;
  actorId: string | null;
  actorType: "system" | "agent" | "customer" | "ai";
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CannedResponse = {
  id: string;
  companyId: string;
  shortcut: string;
  title: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
};

export type EnrichedConversation = SupportConversation & {
  priority: "urgent" | "high" | "normal" | "low";
  snoozedUntil: string | null;
  slaFirstResponseMinutes: number;
  tags: SupportTag[];
  customer: SupportCustomer | null;
};

function mapTag(row: Record<string, unknown>): SupportTag {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    color: row.color as string,
  };
}

function mapCustomer(row: Record<string, unknown>): SupportCustomer {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    email: (row.email as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    lifetimeValue: (row.lifetime_value as number | null) ?? null,
    signupDate: (row.signup_date as string | null) ?? null,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

function mapEvent(row: Record<string, unknown>): ConversationEvent {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    actorId: (row.actor_id as string | null) ?? null,
    actorType: row.actor_type as ConversationEvent["actorType"],
    eventType: row.event_type as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

function mapCanned(row: Record<string, unknown>): CannedResponse {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    shortcut: row.shortcut as string,
    title: row.title as string,
    body: row.body as string,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapEnrichedConversation(
  row: Record<string, unknown>
): EnrichedConversation {
  const base = mapConversation(row);
  const tagsRaw = (row.support_conversation_tags ?? []) as Array<{
    support_tags: Record<string, unknown> | null;
  }>;
  const tags = tagsRaw
    .map((t) => (t.support_tags ? mapTag(t.support_tags) : null))
    .filter((t): t is SupportTag => t !== null);
  const customer = row.support_customers
    ? mapCustomer(row.support_customers as Record<string, unknown>)
    : null;
  return {
    ...base,
    priority: (row.priority as EnrichedConversation["priority"]) ?? "normal",
    snoozedUntil: (row.snoozed_until as string | null) ?? null,
    slaFirstResponseMinutes:
      (row.sla_first_response_minutes as number) ?? 30,
    tags,
    customer,
  };
}

export async function fetchEnrichedInbox(): Promise<EnrichedConversation[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_conversations")
    .select(
      `*, support_conversation_tags ( tag_id, support_tags ( id, company_id, name, color ) ), support_customers ( id, company_id, email, name, phone, lifetime_value, signup_date, last_seen_at, metadata, created_at )`
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (!data) return [];
  return data.map(mapEnrichedConversation);
}

export async function fetchEnrichedConversation(
  id: string
): Promise<EnrichedConversation | null> {
  const sb = await createServerClient();
  const { data: row } = await sb
    .from("support_conversations")
    .select(
      `*, support_conversation_tags ( tag_id, support_tags ( id, company_id, name, color ) ), support_customers ( id, company_id, email, name, phone, lifetime_value, signup_date, last_seen_at, metadata, created_at )`
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  return mapEnrichedConversation(row);
}

export async function fetchConversationEvents(
  conversationId: string
): Promise<ConversationEvent[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_conversation_events")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapEvent);
}

export async function listTags(): Promise<SupportTag[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_tags")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []).map(mapTag);
}

export async function createTag(args: {
  name: string;
  color: string;
  companyId: string;
}): Promise<SupportTag | null> {
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("support_tags")
    .insert({ name: args.name, color: args.color, company_id: args.companyId })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapTag(data);
}

export async function addTagToConversation(args: {
  conversationId: string;
  tagId: string;
  agentId: string;
}): Promise<void> {
  const sb = await createServerClient();
  await sb.from("support_conversation_tags").upsert(
    {
      conversation_id: args.conversationId,
      tag_id: args.tagId,
      added_by: args.agentId,
    },
    { onConflict: "conversation_id,tag_id" }
  );
}

export async function removeTagFromConversation(args: {
  conversationId: string;
  tagId: string;
}): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_conversation_tags")
    .delete()
    .eq("conversation_id", args.conversationId)
    .eq("tag_id", args.tagId);
}

export async function setConversationPriority(args: {
  conversationId: string;
  priority: "urgent" | "high" | "normal" | "low";
}): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("support_conversations")
      .update({ priority: args.priority })
      .eq("id", args.conversationId)
      .select("id"),
    { context: `setConversationPriority(${args.priority})` }
  );
}

export async function snoozeConversation(args: {
  conversationId: string;
  until: string;
}): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("support_conversations")
      .update({ snoozed_until: args.until })
      .eq("id", args.conversationId)
      .select("id"),
    { context: "snoozeConversation" }
  );
}

export async function unsnoozeConversation(
  conversationId: string
): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("support_conversations")
      .update({ snoozed_until: null })
      .eq("id", conversationId)
      .select("id"),
    { context: "unsnoozeConversation" }
  );
}

export async function listCannedResponses(): Promise<CannedResponse[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_canned_responses")
    .select("*")
    .order("shortcut", { ascending: true });
  return (data ?? []).map(mapCanned);
}

export async function createCannedResponse(args: {
  shortcut: string;
  title: string;
  body: string;
  companyId: string;
  createdBy: string;
}): Promise<CannedResponse | null> {
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("support_canned_responses")
    .insert({
      shortcut: args.shortcut,
      title: args.title,
      body: args.body,
      company_id: args.companyId,
      created_by: args.createdBy,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapCanned(data);
}

// ─── Learning engine (post-0036) ───────────────────────────────

export type SupportResolution = {
  id: string;
  conversationId: string;
  companyId: string;
  capturedBy: string | null;
  issueSummary: string;
  whatWorked: string;
  category: string | null;
  precedentResolutionId: string | null;
  createdAt: string;
};

export type SupportDurabilityCheck = {
  id: string;
  conversationId: string;
  companyId: string;
  resolutionId: string | null;
  scheduledFor: string;
  checkedAt: string | null;
  outcome: "held" | "reopened" | "inconclusive" | null;
  notes: string | null;
};

function mapResolution(row: Record<string, unknown>): SupportResolution {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    companyId: row.company_id as string,
    capturedBy: (row.captured_by as string | null) ?? null,
    issueSummary: row.issue_summary as string,
    whatWorked: row.what_worked as string,
    category: (row.category as string | null) ?? null,
    precedentResolutionId:
      (row.precedent_resolution_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapDurability(row: Record<string, unknown>): SupportDurabilityCheck {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    companyId: row.company_id as string,
    resolutionId: (row.resolution_id as string | null) ?? null,
    scheduledFor: row.scheduled_for as string,
    checkedAt: (row.checked_at as string | null) ?? null,
    outcome: (row.outcome as SupportDurabilityCheck["outcome"]) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

/**
 * Capture the resolution learning for a conversation. Called from
 * the resolution-capture form when an agent marks a conversation
 * resolved. Stores the issue summary + what worked so future
 * conversations can read it.
 */
export async function captureResolution(args: {
  conversationId: string;
  companyId: string;
  capturedBy: string;
  issueSummary: string;
  whatWorked: string;
  category?: string | null;
  precedentResolutionId?: string | null;
}): Promise<SupportResolution | null> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_resolutions")
    .insert({
      conversation_id: args.conversationId,
      company_id: args.companyId,
      captured_by: args.capturedBy,
      issue_summary: args.issueSummary,
      what_worked: args.whatWorked,
      category: args.category ?? null,
      precedent_resolution_id: args.precedentResolutionId ?? null,
    })
    .select("*")
    .single();
  if (!data) return null;
  return mapResolution(data);
}

/**
 * Find similar resolutions to a given conversation's recent message
 * content. Sprint 5 will swap the LIKE-based search for embeddings;
 * v1 is a keyword match on category + issue summary. Even simple
 * matching surfaces the institutional memory.
 */
export async function findSimilarResolutions(args: {
  companyId: string;
  searchTerms: string[];
  excludeConversationId?: string;
  limit?: number;
}): Promise<SupportResolution[]> {
  const sb = await createServerClient();
  let query = sb
    .from("support_resolutions")
    .select("*")
    .eq("company_id", args.companyId);
  if (args.excludeConversationId) {
    query = query.neq("conversation_id", args.excludeConversationId);
  }
  // Build an OR filter against the issue_summary + category for any
  // of the supplied terms.
  if (args.searchTerms.length > 0) {
    const ors = args.searchTerms
      .filter((t) => t.length > 2)
      .slice(0, 6)
      .flatMap((t) => [
        `issue_summary.ilike.%${t}%`,
        `category.ilike.%${t}%`,
      ])
      .join(",");
    if (ors) query = query.or(ors);
  }
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 5);
  return (data ?? []).map(mapResolution);
}

/**
 * Past conversations for the same customer — used in the Read
 * Phase panel to show "this person has been here before."
 */
export async function fetchCustomerPriorConversations(args: {
  customerId: string;
  excludeConversationId: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    subject: string | null;
    status: string;
    createdAt: string;
  }>
> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_conversations")
    .select("id, subject, status, created_at")
    .eq("customer_id", args.customerId)
    .neq("id", args.excludeConversationId)
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 5);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    subject: (r.subject as string | null) ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

/**
 * Mark the Read Phase complete for a conversation. The agent
 * pressed "I've read the context, drafting now" — the §0
 * Understanding Gate has been honored.
 */
export async function markReadingComplete(conversationId: string): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_conversations")
    .update({ reading_complete_at: new Date().toISOString() })
    .eq("id", conversationId)
    .is("reading_complete_at", null);
}

/**
 * Durability checks: list due (scheduled_for <= now, checked_at
 * null) so the inbox can show them.
 */
export async function listDueDurabilityChecks(
  companyId: string
): Promise<SupportDurabilityCheck[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_durability_checks")
    .select("*")
    .eq("company_id", companyId)
    .is("checked_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true });
  return (data ?? []).map(mapDurability);
}

export async function recordDurabilityOutcome(args: {
  checkId: string;
  outcome: "held" | "reopened" | "inconclusive";
  notes?: string;
}): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_durability_checks")
    .update({
      checked_at: new Date().toISOString(),
      outcome: args.outcome,
      notes: args.notes ?? null,
    })
    .eq("id", args.checkId);
}

/**
 * Capture the agent's edit of an AI Co-Pilot draft. Called server-
 * side from the agent reply endpoint when the reply was preceded by
 * a Co-Pilot generation. The accumulated corpus teaches the Co-Pilot
 * the company's voice over time.
 */
export async function captureCoPilotEdit(args: {
  conversationId: string;
  companyId: string;
  agentId: string;
  aiDraft: string;
  aiReasoning: string | null;
  agentSent: string;
}): Promise<void> {
  const sb = await createServerClient();
  await sb.from("support_ai_co_pilot_edits").insert({
    conversation_id: args.conversationId,
    company_id: args.companyId,
    agent_id: args.agentId,
    ai_draft: args.aiDraft,
    ai_reasoning: args.aiReasoning,
    agent_sent: args.agentSent,
  });
}

/**
 * Agent growth snapshot — durability + edit-magnitude breakdown
 * over the last 30 days. Visible only to the agent themselves
 * (and their leader, in aggregate).
 */
/**
 * AgentGrowthSnapshot — the §A10 self-view shape. Per A10 the
 * agent sees what the leader sees about them, exactly. The
 * leader-aggregate view (Phase 2 commit 2) reads the SAME fields
 * aggregated across the team. No field exists on the leader view
 * that isn't also visible to the agent here.
 *
 * Per §A11 every field below is a COUNT, not a score. Per §A17
 * positive counts (acknowledgments, answers, next steps,
 * durability held) surface FIRST in the UI so the agent reads
 * what they did well before what they're missing. Per §A18 no
 * field is labeled with a verdict adjective ("productive",
 * "poor", "needs improvement") — the agent renders the verdict
 * on whether the pattern is fair.
 */
export type AgentGrowthSnapshot = {
  agentId: string;
  windowDays: number;

  // §1.6 close-the-loop — what landed
  resolutions: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;

  // §A16 Co-Pilot interactions
  copilotMinor: number;
  copilotModerate: number;
  copilotMajor: number;
  copilotRewrite: number;

  // §A6 Pillar 2 — transparent presence. The agent reads their
  // own load; the System never sends this to a leader without
  // also showing it to the agent first.
  presence: {
    conversationsClaimed: number;
    repliesSent: number;
    awaitingResponse: number;
  };

  // §A11 Coach v6 aggregates. Counts across all the agent's
  // graded replies in the window. The agent reads the pattern;
  // verdict is theirs.
  coachAggregate: {
    repliesGraded: number;
    acknowledgedCount: number;
    answeredCount: number;
    nextStepCount: number;
    risks: {
      unsupportedAbsolutes: number;
      fabricatedSpecifics: number;
      emptyFiller: number;
    };
  };
};

// ─── Phase 7 §4 readouts — outcome-gated method evolution ────

/**
 * §4 Coach rubric readout — does Coach v6 (count-based) produce
 * more durable resolutions than the prior v5 (verdict-shaped) or
 * ungraded baseline?
 *
 * Constitutional sources (ThinkerThinker.md):
 *   - §A2 — design backwards from the §4 readout. This function
 *     IS the readout the Coach v6 reframe was supposed to be
 *     measured against. Ship-before-readout is the §A2 failure
 *     mode this closes.
 *   - §A3 — anti-game-your-own-evaluation defaults. The
 *     comparison is durability_held rate (downstream consequence),
 *     not "did agents accept the Coach v6 grade" (System
 *     agreement). The latter is forbidden per §A3.
 *   - §A4 — surface uncertainties. The function returns sample
 *     sizes so the user can judge whether the difference is
 *     meaningful. No "Coach v6 wins" claim baked into the data.
 *   - §A11 — counts and rates, never verdicts.
 *   - §A18 — labels in the consumer UI (Phase 7 commit 2)
 *     describe the cohorts ("v6-graded" / "pre-v6") rather than
 *     evaluating them ("better" / "worse").
 *
 * Method:
 *   1. Pull all support_conversations for the company that
 *      have AT LEAST ONE completed durability check in the window
 *   2. For each, look at the agent messages — does any have
 *      coach_counts set? Yes → v6 cohort. Else if any has
 *      coach_grade set (and no v6) → v5 cohort. Else → ungraded.
 *   3. For each cohort: count durability_held vs reopened vs
 *      inconclusive.
 *   4. Return cohort counts + held rates. Confidence tier is the
 *      consumer's call.
 *
 * What this readout does NOT claim
 * ────────────────────────────────
 *   - Controlled comparison. The cohorts aren't randomized;
 *     they reflect when each rubric was active. Confounds
 *     (issue category mix shifts, agent skill drift) are NOT
 *     controlled for. Per §A4 the user sees this caveat.
 *   - Statistical significance. We surface N; the user judges.
 *     The §A4 uncertainty about what threshold counts as
 *     "meaningful" is deferred to the user's outside-view read.
 *   - Forward causation. If v6 cohorts hold durably more, it's
 *     a SIGNAL worth investigating, not proof v6 caused the
 *     improvement.
 */
export type CoachRubricReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    v6: ReadoutCohort;
    v5: ReadoutCohort;
    ungraded: ReadoutCohort;
  };
};

export type ReadoutCohort = {
  conversationCount: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;
  durabilityHeldRate: number | null; // null when n=0
};

export async function fetchCoachRubricReadout(args: {
  companyId: string;
  windowDays?: number;
}): Promise<CoachRubricReadout> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 60;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1. Conversations with a completed durability check in the window.
  const { data: checks } = await sb
    .from("support_durability_checks")
    .select("conversation_id, outcome")
    .eq("company_id", args.companyId)
    .not("outcome", "is", null)
    .gte("checked_at", since)
    .limit(5000);

  type CheckRow = {
    conversation_id: string;
    outcome: "held" | "reopened" | "inconclusive";
  };
  const checkRows = (checks ?? []) as CheckRow[];

  if (checkRows.length === 0) {
    const empty: ReadoutCohort = {
      conversationCount: 0,
      durabilityHeld: 0,
      durabilityReopened: 0,
      durabilityInconclusive: 0,
      durabilityHeldRate: null,
    };
    return {
      windowDays,
      companyId: args.companyId,
      cohorts: { v6: empty, v5: { ...empty }, ungraded: { ...empty } },
    };
  }

  const conversationIds = Array.from(
    new Set(checkRows.map((c) => c.conversation_id))
  );

  // 2. Look at agent messages on those conversations to classify
  // each conversation's rubric version.
  const { data: msgs } = await sb
    .from("support_messages")
    .select("conversation_id, coach_counts, coach_grade")
    .in("conversation_id", conversationIds)
    .eq("author_type", "agent")
    .eq("is_internal_note", false);

  type MsgRow = {
    conversation_id: string;
    coach_counts: unknown | null;
    coach_grade: string | null;
  };
  const msgRows = (msgs ?? []) as MsgRow[];

  type Bucket = "v6" | "v5" | "ungraded";
  const cohortByConv = new Map<string, Bucket>();
  for (const m of msgRows) {
    const current = cohortByConv.get(m.conversation_id) ?? "ungraded";
    let next: Bucket = current;
    if (m.coach_counts !== null && m.coach_counts !== undefined) {
      next = "v6"; // v6 wins regardless
    } else if (
      m.coach_grade !== null &&
      m.coach_grade !== undefined &&
      current === "ungraded"
    ) {
      next = "v5";
    }
    if (rank(next) > rank(current)) {
      cohortByConv.set(m.conversation_id, next);
    } else if (!cohortByConv.has(m.conversation_id)) {
      cohortByConv.set(m.conversation_id, current);
    }
  }
  // Conversations with no agent messages at all also count as
  // ungraded — they show up in checks but never had a rubric
  // applied (rare; defensive).
  for (const id of conversationIds) {
    if (!cohortByConv.has(id)) cohortByConv.set(id, "ungraded");
  }

  // 3. Aggregate.
  const init = (): ReadoutCohort => ({
    conversationCount: 0,
    durabilityHeld: 0,
    durabilityReopened: 0,
    durabilityInconclusive: 0,
    durabilityHeldRate: null,
  });
  const cohorts: Record<Bucket, ReadoutCohort> = {
    v6: init(),
    v5: init(),
    ungraded: init(),
  };

  const counted = new Set<string>();
  for (const c of checkRows) {
    const b = cohortByConv.get(c.conversation_id) ?? "ungraded";
    if (!counted.has(c.conversation_id)) {
      cohorts[b].conversationCount += 1;
      counted.add(c.conversation_id);
    }
    if (c.outcome === "held") cohorts[b].durabilityHeld += 1;
    else if (c.outcome === "reopened") cohorts[b].durabilityReopened += 1;
    else if (c.outcome === "inconclusive")
      cohorts[b].durabilityInconclusive += 1;
  }
  for (const b of ["v6", "v5", "ungraded"] as const) {
    const k = cohorts[b];
    const totalChecks =
      k.durabilityHeld + k.durabilityReopened + k.durabilityInconclusive;
    k.durabilityHeldRate =
      totalChecks > 0 ? k.durabilityHeld / totalChecks : null;
  }

  return {
    windowDays,
    companyId: args.companyId,
    cohorts,
  };
}

function rank(b: "v6" | "v5" | "ungraded"): number {
  return b === "v6" ? 2 : b === "v5" ? 1 : 0;
}

// ─── Phase 5 routing — agent presence + auto-routing ─────────

/**
 * Phase 5: route a freshly-created conversation to the best
 * available agent OR mark it as unrouted.
 *
 * Picks an agent where:
 *   - status = 'online' (per §A6 Pillar 2 transparent presence)
 *   - the channel is in their settings.channels list
 *   - their currently-open conversation count < max_concurrent
 *
 * Among eligible, picks the least-loaded (fewest open
 * conversations). Ties broken by oldest last_seen_at (oldest
 * waited longest — fair distribution).
 *
 * Per §A18 the routing decision is recorded as a routing_method
 * (auto_least_loaded vs unrouted), never as a verdict on which
 * agent is "best." The least-loaded heuristic surfaces capacity,
 * not performance.
 *
 * When auto-routed:
 *   - assigned_agent_id is set
 *   - ai_responding is flipped off (agent takes the conversation)
 *   - status moves to in_conversation
 *
 * When unrouted (no eligible agent):
 *   - assigned_agent_id stays null
 *   - ai_responding stays true (AI handles first-response while
 *     the conversation waits in the Unassigned inbox view)
 */
export async function routeNewConversation(args: {
  conversationId: string;
  companyId: string;
  source: string;
}): Promise<{
  assignedAgentId: string | null;
  routingMethod: "auto_least_loaded" | "unrouted";
}> {
  const sb = createServiceRoleClient();

  // 1. Find eligible online agents who handle this channel.
  const { data: candidates } = await sb
    .from("care_agent_state")
    .select("agent_id, max_concurrent, channels, last_seen_at")
    .eq("company_id", args.companyId)
    .eq("status", "online")
    .contains("channels", [args.source]);

  if (!candidates || candidates.length === 0) {
    await sb
      .from("support_conversations")
      .update({ routing_method: "unrouted" })
      .eq("id", args.conversationId);
    return { assignedAgentId: null, routingMethod: "unrouted" };
  }

  // 2. Compute current load per candidate.
  const agentIds = candidates.map(
    (c) => c.agent_id as string
  );
  const { data: openConvs } = await sb
    .from("support_conversations")
    .select("assigned_agent_id")
    .eq("company_id", args.companyId)
    .in("assigned_agent_id", agentIds)
    .in("status", ["open", "in_conversation", "awaiting_customer"]);

  const loadByAgent = new Map<string, number>();
  for (const c of openConvs ?? []) {
    const id = c.assigned_agent_id as string | null;
    if (!id) continue;
    loadByAgent.set(id, (loadByAgent.get(id) ?? 0) + 1);
  }

  // 3. Filter to under-capacity, sort by (load asc, last_seen_at asc).
  const eligible = candidates
    .map((c) => ({
      agentId: c.agent_id as string,
      load: loadByAgent.get(c.agent_id as string) ?? 0,
      maxConcurrent: c.max_concurrent as number,
      lastSeenAt: c.last_seen_at as string,
    }))
    .filter((c) => c.load < c.maxConcurrent)
    .sort((a, b) => {
      if (a.load !== b.load) return a.load - b.load;
      return (a.lastSeenAt ?? "").localeCompare(b.lastSeenAt ?? "");
    });

  if (eligible.length === 0) {
    await sb
      .from("support_conversations")
      .update({ routing_method: "unrouted" })
      .eq("id", args.conversationId);
    return { assignedAgentId: null, routingMethod: "unrouted" };
  }

  const winner = eligible[0]!;

  // 4. Assign. Use strictMutate so a silent RLS rejection
  // surfaces honestly (A13).
  await strictMutate(
    sb
      .from("support_conversations")
      .update({
        assigned_agent_id: winner.agentId,
        routed_at: new Date().toISOString(),
        routing_method: "auto_least_loaded",
        ai_responding: false,
        status: "in_conversation",
      })
      .eq("id", args.conversationId)
      .select("id"),
    { context: "routeNewConversation.assign" }
  );

  return {
    assignedAgentId: winner.agentId,
    routingMethod: "auto_least_loaded",
  };
}

/**
 * Agent presence — read own state.
 */
export type AgentPresence = {
  agentId: string;
  companyId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: string;
  maxConcurrent: number;
  channels: string[];
  currentLoad: number;
};

export async function fetchAgentPresence(
  agentId: string
): Promise<AgentPresence | null> {
  const sb = await createServerClient();
  const { data: state } = await sb
    .from("care_agent_state")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!state) return null;

  const { count } = await sb
    .from("support_conversations")
    .select("id", { count: "exact", head: true })
    .eq("assigned_agent_id", agentId)
    .in("status", ["open", "in_conversation", "awaiting_customer"]);

  return {
    agentId: state.agent_id as string,
    companyId: state.company_id as string,
    status: state.status as AgentPresence["status"],
    lastSeenAt: state.last_seen_at as string,
    maxConcurrent: state.max_concurrent as number,
    channels: (state.channels as string[]) ?? [],
    currentLoad: count ?? 0,
  };
}

/**
 * Team presence aggregate for the leader view. Per §A18 this
 * does NOT include per-agent performance metrics; it surfaces
 * presence counts (how many are online, how many are at
 * capacity) so the leader can answer "do we have coverage" —
 * not "who's slacking."
 */
export type TeamPresenceSnapshot = {
  companyId: string;
  totalAgents: number;
  onlineCount: number;
  awayCount: number;
  offlineCount: number;
  atCapacityCount: number;
  totalCurrentLoad: number;
  channelCoverage: Record<string, number>;
};

export async function fetchTeamPresence(
  companyId: string
): Promise<TeamPresenceSnapshot> {
  const sb = await createServerClient();
  const { data: states } = await sb
    .from("care_agent_state")
    .select("agent_id, status, max_concurrent, channels")
    .eq("company_id", companyId);

  type StateRow = {
    agent_id: string;
    status: string;
    max_concurrent: number;
    channels: string[];
  };
  const rows = (states ?? []) as StateRow[];

  let onlineCount = 0;
  let awayCount = 0;
  let offlineCount = 0;
  const channelCoverage: Record<string, number> = {};
  for (const s of rows) {
    if (s.status === "online") onlineCount += 1;
    else if (s.status === "away") awayCount += 1;
    else offlineCount += 1;
    if (s.status === "online") {
      for (const ch of s.channels ?? []) {
        channelCoverage[ch] = (channelCoverage[ch] ?? 0) + 1;
      }
    }
  }

  // Load per agent (only those with assignments).
  const agentIds = rows.map((s) => s.agent_id);
  let totalCurrentLoad = 0;
  let atCapacityCount = 0;
  if (agentIds.length > 0) {
    const { data: openConvs } = await sb
      .from("support_conversations")
      .select("assigned_agent_id")
      .in("assigned_agent_id", agentIds)
      .in("status", ["open", "in_conversation", "awaiting_customer"]);
    const loadByAgent = new Map<string, number>();
    for (const c of openConvs ?? []) {
      const id = c.assigned_agent_id as string | null;
      if (!id) continue;
      loadByAgent.set(id, (loadByAgent.get(id) ?? 0) + 1);
    }
    for (const s of rows) {
      const load = loadByAgent.get(s.agent_id) ?? 0;
      totalCurrentLoad += load;
      if (load >= s.max_concurrent) atCapacityCount += 1;
    }
  }

  return {
    companyId,
    totalAgents: rows.length,
    onlineCount,
    awayCount,
    offlineCount,
    atCapacityCount,
    totalCurrentLoad,
    channelCoverage,
  };
}

/**
 * Touch the heartbeat — called on agent activity so 'online'
 * status reflects real presence. App-managed.
 */
export async function touchAgentHeartbeat(agentId: string): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("care_agent_state")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("agent_id", agentId);
}

/**
 * Agent updates their own status. Only status (and last_seen_at
 * implicitly via touch) — capacity/channels are admin-controlled.
 */
export async function setAgentStatus(args: {
  agentId: string;
  status: "online" | "away" | "offline";
}): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("care_agent_state")
      .update({
        status: args.status,
        last_seen_at: new Date().toISOString(),
      })
      .eq("agent_id", args.agentId)
      .select("agent_id"),
    { context: `setAgentStatus(${args.status})` }
  );
}

/**
 * Admin updates agent capacity + channels for an agent in their
 * company. RLS validates the admin's authority; this function
 * trusts the caller resolved that already.
 */
export async function setAgentRoutingSettings(args: {
  agentId: string;
  maxConcurrent?: number;
  channels?: string[];
}): Promise<void> {
  const sb = await createServerClient();
  const patch: Record<string, unknown> = {};
  if (typeof args.maxConcurrent === "number") {
    patch.max_concurrent = args.maxConcurrent;
  }
  if (Array.isArray(args.channels)) {
    patch.channels = args.channels;
  }
  if (Object.keys(patch).length === 0) return;
  await strictMutate(
    sb
      .from("care_agent_state")
      .update(patch)
      .eq("agent_id", args.agentId)
      .select("agent_id"),
    { context: "setAgentRoutingSettings" }
  );
}

/**
 * TeamGrowthSnapshot — the leader-aggregate view per §A6 + §A10.
 *
 * Shape mirrors AgentGrowthSnapshot fields aggregated across the
 * team. Per §A18 there is NO individual breakdown here — the
 * leader sees team-aggregate only. Per §A10 every field below
 * IS already visible to each agent on their own self-view; the
 * leader view aggregates, doesn't reveal anything individual
 * the agent doesn't already see.
 *
 * The agent self-view (src/app/dashboard/care/growth) shipped
 * before this surface per the §A10 pre-merge gate. No field
 * lives on this team view that isn't on the agent self-view.
 */
export type TeamGrowthSnapshot = {
  companyId: string;
  windowDays: number;
  agentCount: number;

  // §1.6 close-the-loop — team aggregate
  resolutions: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;

  // §A16 Co-Pilot — team aggregate
  copilotMinor: number;
  copilotModerate: number;
  copilotMajor: number;
  copilotRewrite: number;

  // §A6 Pillar 2 — team load aggregate
  presence: {
    conversationsClaimed: number;
    repliesSent: number;
    awaitingResponse: number;
  };

  // §A11 Coach v6 — team-aggregate counts
  coachAggregate: {
    repliesGraded: number;
    acknowledgedCount: number;
    answeredCount: number;
    nextStepCount: number;
    risks: {
      unsupportedAbsolutes: number;
      fabricatedSpecifics: number;
      emptyFiller: number;
    };
  };
};

/**
 * Aggregate the team's growth snapshot across all agents in the
 * company. Per §A18 the leader sees this aggregate ONLY — no
 * per-agent breakdown, no stack-rank, no comparison.
 *
 * Implementation note: we sum at the query layer (single roundtrip
 * with company_id filters) rather than fetching each agent's
 * snapshot individually. This is also the §A18 structural
 * defense: the data layer never produces per-agent rows for the
 * leader view, so it's impossible to accidentally surface one.
 */
export async function fetchTeamGrowth(
  companyId: string
): Promise<TeamGrowthSnapshot> {
  const sb = await createServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    agents,
    resolutions,
    durability,
    edits,
    claimedConvs,
    awaitingConvs,
    agentReplies,
    coachCountsRows,
  ] = await Promise.all([
    sb
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .or("is_support_agent.eq.true,role.in.(CEO,COO,admin)"),
    sb
      .from("support_resolutions")
      .select("id")
      .eq("company_id", companyId)
      .gte("created_at", since),
    sb
      .from("support_durability_checks")
      .select("outcome")
      .eq("company_id", companyId)
      .not("outcome", "is", null)
      .gte("checked_at", since),
    sb
      .from("support_ai_co_pilot_edits")
      .select("edit_magnitude")
      .eq("company_id", companyId)
      .gte("created_at", since),
    sb
      .from("support_conversations")
      .select("id")
      .eq("company_id", companyId)
      .not("assigned_agent_id", "is", null)
      .gte("created_at", since),
    sb
      .from("support_conversations")
      .select("id")
      .eq("company_id", companyId)
      .not("assigned_agent_id", "is", null)
      .in("status", ["open", "in_conversation"]),
    sb
      .from("support_messages")
      .select("id, support_conversations!inner(company_id)")
      .eq("author_type", "agent")
      .eq("is_internal_note", false)
      .eq("support_conversations.company_id", companyId)
      .gte("created_at", since),
    sb
      .from("support_messages")
      .select("coach_counts, support_conversations!inner(company_id)")
      .eq("author_type", "agent")
      .eq("is_internal_note", false)
      .eq("support_conversations.company_id", companyId)
      .not("coach_counts", "is", null)
      .gte("created_at", since),
  ]);

  const durRows = (durability.data ?? []) as Array<{ outcome: string | null }>;
  const editRows = (edits.data ?? []) as Array<{
    edit_magnitude: string | null;
  }>;
  type CoachRow = {
    coach_counts: {
      positive?: {
        acknowledged?: number;
        answered?: number;
        next_step?: number;
      };
      risks?: {
        unsupported_absolutes?: number;
        fabricated_specifics?: number;
        empty_filler?: number;
      };
    } | null;
  };
  const coachRows = (coachCountsRows.data ?? []) as unknown as CoachRow[];

  let acknowledgedCount = 0;
  let answeredCount = 0;
  let nextStepCount = 0;
  let unsupportedAbsolutes = 0;
  let fabricatedSpecifics = 0;
  let emptyFiller = 0;
  for (const row of coachRows) {
    const c = row.coach_counts;
    if (!c) continue;
    acknowledgedCount += c.positive?.acknowledged ?? 0;
    answeredCount += c.positive?.answered ?? 0;
    nextStepCount += c.positive?.next_step ?? 0;
    unsupportedAbsolutes += c.risks?.unsupported_absolutes ?? 0;
    fabricatedSpecifics += c.risks?.fabricated_specifics ?? 0;
    emptyFiller += c.risks?.empty_filler ?? 0;
  }

  return {
    companyId,
    windowDays: 30,
    agentCount: agents.data?.length ?? 0,
    resolutions: resolutions.data?.length ?? 0,
    durabilityHeld: durRows.filter((r) => r.outcome === "held").length,
    durabilityReopened: durRows.filter((r) => r.outcome === "reopened").length,
    durabilityInconclusive: durRows.filter((r) => r.outcome === "inconclusive")
      .length,
    copilotMinor: editRows.filter((r) => r.edit_magnitude === "minor").length,
    copilotModerate: editRows.filter((r) => r.edit_magnitude === "moderate")
      .length,
    copilotMajor: editRows.filter((r) => r.edit_magnitude === "major").length,
    copilotRewrite: editRows.filter((r) => r.edit_magnitude === "rewrite")
      .length,
    presence: {
      conversationsClaimed: claimedConvs.data?.length ?? 0,
      repliesSent: agentReplies.data?.length ?? 0,
      awaitingResponse: awaitingConvs.data?.length ?? 0,
    },
    coachAggregate: {
      repliesGraded: coachRows.length,
      acknowledgedCount,
      answeredCount,
      nextStepCount,
      risks: {
        unsupportedAbsolutes,
        fabricatedSpecifics,
        emptyFiller,
      },
    },
  };
}

// ─── Pattern detection (post-0036) ────────────────────────────

export type SupportPattern = {
  category: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleConversationIds: string[];
};

/**
 * Aggregate recently-captured resolutions by category. A pattern
 * is born when 3+ resolutions share the same category in the
 * window. The §3.2 Understanding Gate for support — a recurring
 * problem can't reach the team that fixes root causes until the
 * pattern is real (3+ instances).
 *
 * Sprint 6 will replace the exact-string aggregation with
 * embeddings cluster so "refund won't process" and "couldn't
 * refund" land in the same pattern.
 */
export async function detectSupportPatterns(args: {
  windowDays?: number;
  minCount?: number;
}): Promise<SupportPattern[]> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 30;
  const minCount = args.minCount ?? 3;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await sb
    .from("support_resolutions")
    .select("category, conversation_id, created_at")
    .not("category", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const byCategory = new Map<
    string,
    {
      count: number;
      firstSeen: string;
      lastSeen: string;
      conversationIds: string[];
    }
  >();
  for (const r of data ?? []) {
    const cat = (r.category as string).trim();
    if (!cat) continue;
    const entry = byCategory.get(cat);
    if (entry) {
      entry.count += 1;
      entry.firstSeen = r.created_at as string;
      if (entry.conversationIds.length < 5) {
        entry.conversationIds.push(r.conversation_id as string);
      }
    } else {
      byCategory.set(cat, {
        count: 1,
        firstSeen: r.created_at as string,
        lastSeen: r.created_at as string,
        conversationIds: [r.conversation_id as string],
      });
    }
  }

  const patterns: SupportPattern[] = [];
  for (const [category, e] of byCategory) {
    if (e.count >= minCount) {
      patterns.push({
        category,
        count: e.count,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
        sampleConversationIds: e.conversationIds,
      });
    }
  }
  patterns.sort((a, b) => b.count - a.count);
  return patterns;
}

/**
 * Coach v6 risk patterns — team-level only per §A18.
 *
 * Scans support_messages.coach_counts for the company in the
 * window. When a specific risk category (unsupported_absolutes,
 * fabricated_specifics, empty_filler) accumulates above the §3.2
 * Understanding Gate threshold, it surfaces as a team pattern.
 *
 * §A18 STRUCTURAL: this function intentionally NEVER groups by
 * agent. The aggregate is across the team's messages. A leader
 * cannot accidentally see a per-agent breakdown from this code
 * path because the data layer never produces one. Same
 * structural defense the team-aggregate growth view uses.
 *
 * §A11: the surfaced pattern is a COUNT — "12 unsupported
 * absolutes accumulated this week" — never a verdict. The team
 * decides whether the pattern is fair (sometimes the product
 * context simply lacks the grounding the team needs; the fix
 * is upstream of the agent).
 *
 * sampleConversationIds for each risk category come from the
 * conversations where the risk was actually counted, so the
 * pattern row can drill into the §3.1 events that support it
 * (§A14 multi-state render verification: the user can verify
 * the pattern is real, not trust the System's read).
 */
export type CoachRiskPattern = {
  riskCategory: "unsupported_absolutes" | "fabricated_specifics" | "empty_filler";
  totalInstances: number;
  repliesScanned: number;
  windowDays: number;
  firstSeen: string;
  lastSeen: string;
  sampleConversationIds: string[];
};

export async function detectCoachRiskPatterns(args: {
  companyId: string;
  windowDays?: number;
  minInstances?: number;
}): Promise<CoachRiskPattern[]> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 30;
  // §3.2 + §A4 — 5 is the initial threshold. The §4 readout in
  // Phase 7 should refine this. Per A4 we surface the uncertainty
  // rather than pre-deciding it's the right number.
  const minInstances = args.minInstances ?? 5;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // Pull all v6-graded agent replies in the window for this
  // company. The query joins through support_conversations so
  // we can scope by company_id (support_messages itself doesn't
  // have a company_id column).
  const { data: rows } = await sb
    .from("support_messages")
    .select(
      "conversation_id, coach_counts, created_at, support_conversations!inner(company_id)"
    )
    .eq("author_type", "agent")
    .eq("is_internal_note", false)
    .eq("support_conversations.company_id", args.companyId)
    .not("coach_counts", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  type Row = {
    conversation_id: string;
    coach_counts: {
      risks?: {
        unsupported_absolutes?: number;
        fabricated_specifics?: number;
        empty_filler?: number;
      };
    } | null;
    created_at: string;
  };
  const messageRows = (rows ?? []) as unknown as Row[];

  type Acc = {
    totalInstances: number;
    firstSeen: string;
    lastSeen: string;
    conversationIds: string[];
  };
  const initAcc = (createdAt: string): Acc => ({
    totalInstances: 0,
    firstSeen: createdAt,
    lastSeen: createdAt,
    conversationIds: [],
  });
  const buckets: Record<CoachRiskPattern["riskCategory"], Acc> = {
    unsupported_absolutes: initAcc(""),
    fabricated_specifics: initAcc(""),
    empty_filler: initAcc(""),
  };

  for (const row of messageRows) {
    const r = row.coach_counts?.risks;
    if (!r) continue;
    const consider = (
      key: CoachRiskPattern["riskCategory"],
      val: number | undefined
    ) => {
      if (!val || val <= 0) return;
      const b = buckets[key];
      b.totalInstances += val;
      if (!b.firstSeen || row.created_at < b.firstSeen) {
        b.firstSeen = row.created_at;
      }
      if (!b.lastSeen || row.created_at > b.lastSeen) {
        b.lastSeen = row.created_at;
      }
      if (
        b.conversationIds.length < 5 &&
        !b.conversationIds.includes(row.conversation_id)
      ) {
        b.conversationIds.push(row.conversation_id);
      }
    };
    consider("unsupported_absolutes", r.unsupported_absolutes);
    consider("fabricated_specifics", r.fabricated_specifics);
    consider("empty_filler", r.empty_filler);
  }

  const out: CoachRiskPattern[] = [];
  for (const key of [
    "unsupported_absolutes",
    "fabricated_specifics",
    "empty_filler",
  ] as const) {
    const b = buckets[key];
    if (b.totalInstances >= minInstances) {
      out.push({
        riskCategory: key,
        totalInstances: b.totalInstances,
        repliesScanned: messageRows.length,
        windowDays,
        firstSeen: b.firstSeen,
        lastSeen: b.lastSeen,
        sampleConversationIds: b.conversationIds,
      });
    }
  }
  out.sort((a, b) => b.totalInstances - a.totalInstances);
  return out;
}

export async function fetchAgentGrowth(
  agentId: string
): Promise<AgentGrowthSnapshot> {
  const sb = await createServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    resolutions,
    durability,
    edits,
    claimedConvs,
    awaitingConvs,
    agentReplies,
    coachCountsRows,
  ] = await Promise.all([
    sb
      .from("support_resolutions")
      .select("id")
      .eq("captured_by", agentId)
      .gte("created_at", since),
    sb
      .from("support_durability_checks")
      .select("outcome, support_resolutions!inner(captured_by)")
      .eq("support_resolutions.captured_by", agentId)
      .not("outcome", "is", null)
      .gte("checked_at", since),
    sb
      .from("support_ai_co_pilot_edits")
      .select("edit_magnitude")
      .eq("agent_id", agentId)
      .gte("created_at", since),
    // §A6 Pillar 2 — conversations the agent claimed in the
    // window. Includes already-resolved and still-open.
    sb
      .from("support_conversations")
      .select("id")
      .eq("assigned_agent_id", agentId)
      .gte("created_at", since),
    // §A6 Pillar 2 — current load — conversations claimed by
    // the agent that are not yet closed/resolved. Open and
    // in_conversation count; awaiting_customer means the ball
    // is with the customer, not the agent.
    sb
      .from("support_conversations")
      .select("id, status")
      .eq("assigned_agent_id", agentId)
      .in("status", ["open", "in_conversation"]),
    // §A6 — public replies sent by this agent in the window.
    sb
      .from("support_messages")
      .select("id")
      .eq("author_id", agentId)
      .eq("author_type", "agent")
      .eq("is_internal_note", false)
      .gte("created_at", since),
    // §A11 — Coach v6 count aggregates over the window. Only
    // messages graded under v6 (coach_counts not null) are
    // counted; v5-graded messages are excluded so the aggregate
    // is honest about which rubric produced it.
    sb
      .from("support_messages")
      .select("coach_counts")
      .eq("author_id", agentId)
      .eq("author_type", "agent")
      .eq("is_internal_note", false)
      .not("coach_counts", "is", null)
      .gte("created_at", since),
  ]);

  const durRows = (durability.data ?? []) as Array<{ outcome: string | null }>;
  const editRows = (edits.data ?? []) as Array<{
    edit_magnitude: string | null;
  }>;

  // §A11 — accumulate Coach v6 counts honestly. Each graded
  // reply contributes its positive presences (0 or 1 per
  // category) and risk counts. The aggregate is the SUM, not an
  // average — the agent reads "acknowledged in N of M replies"
  // not "acknowledgment score: X%" per A18.
  type CoachRow = {
    coach_counts: {
      positive?: {
        acknowledged?: number;
        answered?: number;
        next_step?: number;
      };
      risks?: {
        unsupported_absolutes?: number;
        fabricated_specifics?: number;
        empty_filler?: number;
      };
    } | null;
  };
  const coachRows = (coachCountsRows.data ?? []) as CoachRow[];
  const repliesGraded = coachRows.length;
  let acknowledgedCount = 0;
  let answeredCount = 0;
  let nextStepCount = 0;
  let unsupportedAbsolutes = 0;
  let fabricatedSpecifics = 0;
  let emptyFiller = 0;
  for (const row of coachRows) {
    const c = row.coach_counts;
    if (!c) continue;
    acknowledgedCount += c.positive?.acknowledged ?? 0;
    answeredCount += c.positive?.answered ?? 0;
    nextStepCount += c.positive?.next_step ?? 0;
    unsupportedAbsolutes += c.risks?.unsupported_absolutes ?? 0;
    fabricatedSpecifics += c.risks?.fabricated_specifics ?? 0;
    emptyFiller += c.risks?.empty_filler ?? 0;
  }

  return {
    agentId,
    windowDays: 30,
    resolutions: resolutions.data?.length ?? 0,
    durabilityHeld: durRows.filter((r) => r.outcome === "held").length,
    durabilityReopened: durRows.filter((r) => r.outcome === "reopened").length,
    durabilityInconclusive: durRows.filter(
      (r) => r.outcome === "inconclusive"
    ).length,
    copilotMinor: editRows.filter((r) => r.edit_magnitude === "minor").length,
    copilotModerate: editRows.filter(
      (r) => r.edit_magnitude === "moderate"
    ).length,
    copilotMajor: editRows.filter((r) => r.edit_magnitude === "major").length,
    copilotRewrite: editRows.filter(
      (r) => r.edit_magnitude === "rewrite"
    ).length,
    presence: {
      conversationsClaimed: claimedConvs.data?.length ?? 0,
      repliesSent: agentReplies.data?.length ?? 0,
      awaitingResponse: awaitingConvs.data?.length ?? 0,
    },
    coachAggregate: {
      repliesGraded,
      acknowledgedCount,
      answeredCount,
      nextStepCount,
      risks: {
        unsupportedAbsolutes,
        fabricatedSpecifics,
        emptyFiller,
      },
    },
  };
}
