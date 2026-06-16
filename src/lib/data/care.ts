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
  // §0 Understanding Gate moment for support (0036). Null until
  // the agent has reviewed the Read Phase panel.
  readingCompleteAt: string | null;
  // §1.1 captured outcome category (0036) for pattern detection.
  resolutionOutcomeCategory: string | null;
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
  coachGrade: "productive" | "neutral" | "needs_guidance" | "withheld" | null;
  coachReasonInternal: string | null;
  coachGradedAt: string | null;
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
  await sb
    .from("support_conversations")
    .update({ priority: args.priority })
    .eq("id", args.conversationId);
}

export async function snoozeConversation(args: {
  conversationId: string;
  until: string;
}): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_conversations")
    .update({ snoozed_until: args.until })
    .eq("id", args.conversationId);
}

export async function unsnoozeConversation(
  conversationId: string
): Promise<void> {
  const sb = await createServerClient();
  await sb
    .from("support_conversations")
    .update({ snoozed_until: null })
    .eq("id", conversationId);
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
export type AgentGrowthSnapshot = {
  agentId: string;
  windowDays: number;
  resolutions: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;
  copilotMinor: number;
  copilotModerate: number;
  copilotMajor: number;
  copilotRewrite: number;
};

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

export async function fetchAgentGrowth(
  agentId: string
): Promise<AgentGrowthSnapshot> {
  const sb = await createServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [resolutions, durability, edits] = await Promise.all([
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
  ]);

  const durRows = (durability.data ?? []) as Array<{ outcome: string | null }>;
  const editRows = (edits.data ?? []) as Array<{
    edit_magnitude: string | null;
  }>;

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
  };
}
