import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";
import { strictMutate } from "@/lib/supabase/strictUpdate";
import { notifyAssignedAgentOfCustomerMessage } from "@/lib/notifications/careNotify";
import { sanitizeOrIlikeTerm } from "@/lib/data/searchTerm";

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
  lastMessageAuthorType: string | null; // 0087 — author of the most recent message
  firstResponseAt: string | null;
  resolvedAt: string | null;
  // §0 Understanding Gate moment for support (0036). Null until
  // the agent has reviewed the Read Phase panel.
  readingCompleteAt: string | null;
  // §1.1 captured outcome category (0036) for pattern detection.
  resolutionOutcomeCategory: string | null;
  // Supervisor guidance flag (0044). Non-null when an agent has
  // requested supervisor input on this conversation. Orthogonal
  // to status — a conversation in any status can carry a flag.
  supervisorGuidanceRequestedAt: string | null;
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
  /** 0058 — message kind. Default 'message'; 'attachment' for
   *  file uploads (media_url carries the file pointer). */
  kind: "message" | "attachment" | "system";
  mediaUrl: string | null;
  mediaType: string | null;
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
    // 0087 — who authored the most recent message (drives the inbox-wide new-
    // customer-message chime). Null on rows that predate 0087 until re-stamped.
    lastMessageAuthorType:
      (row.last_message_author_type as string | null) ?? null,
    firstResponseAt: (row.first_response_at as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    readingCompleteAt: (row.reading_complete_at as string | null) ?? null,
    resolutionOutcomeCategory:
      (row.resolution_outcome_category as string | null) ?? null,
    supervisorGuidanceRequestedAt:
      (row.supervisor_guidance_requested_at as string | null) ?? null,
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
    kind: (row.kind as SupportMessage["kind"]) ?? "message",
    mediaUrl: (row.media_url as string | null) ?? null,
    mediaType: (row.media_type as string | null) ?? null,
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
    // Log in ALL environments — the dev-only warn was hiding
    // production failures (RLS, schema drift, missing FK) at
    // the exact moment we needed to see them. The widget gives
    // the user 'Couldn't send'; this line tells the operator
    // why.
    // eslint-disable-next-line no-console
    console.error(
      `[care.createConversation] insert failed companyId=${args.companyId} source=${args.source ?? "web_widget"} error=${error?.message ?? "no row returned"}`
    );
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
  medium?: "text" | "voice";
  /** 0058 — customer-uploaded files post an attachment-kind
   *  message; media_url carries the file pointer. */
  kind?: "message" | "attachment";
  mediaUrl?: string | null;
  mediaType?: string | null;
}): Promise<SupportMessage | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("support_messages")
    .insert({
      conversation_id: args.conversationId,
      author_type: "customer",
      body: args.body,
      medium: args.medium ?? "text",
      kind: args.kind ?? "message",
      media_url: args.mediaUrl ?? null,
      media_type: args.mediaType ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[care.postCustomerMessage] insert failed conversationId=${args.conversationId} error=${error?.message ?? "no row returned"}`
    );
    return null;
  }
  // Queue #2: push the assigned agent that a customer replied
  // (fire-and-forget; never blocks the message write).
  void notifyAssignedAgentOfCustomerMessage({
    conversationId: args.conversationId,
    body: args.body,
  });
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
  const { error } = await sb
    .from("support_conversations")
    .update({ ai_responding: false })
    .eq("id", conversationId);
  // Observability (audit 2026-07-09): a silent failure here is a BROKEN PROMISE
  // to the customer — both call sites have already told them "I'm bringing in a
  // teammate", but if this flip doesn't land, ai_responding stays true and the
  // next customer message gets ANOTHER AI reply instead of the human. Log it in
  // all environments so the operator sees a stuck handoff, matching the
  // create-conversation / post-message pattern in this file. (Kept void: both
  // callers are post-message fire-and-forget; escalate to retry only if the log
  // shows real failures — §1.5 organic.)
  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[care.markConversationHandedOff] flip failed conversationId=${conversationId} error=${error.message} — AI may keep replying after a handoff was promised`
    );
  }
}

// ─── Agent-side (authenticated; RLS-scoped) ──────────────────

/**
 * Lightweight C.A.R.E counts for the Command Center surface.
 *
 * Per TT.md A21 (2026-06-18) — Command Center is the operational
 * hub, but until this fix it surfaced tasks/signals/problems/
 * resolutions WITHOUT any support state. A tenant running
 * C.A.R.E would land on Command Center and not see open
 * customer conversations, supervisor-guidance-needed cases,
 * or unread incoming messages. L3 composition gap: the user's
 * "daily standup" view was incomplete.
 *
 * Returns:
 *   - hasActivity: true if the tenant has ANY support
 *     conversation ever (gates whether to show the section)
 *   - openCount: status in (new, open, assigned, waiting)
 *   - needsGuidanceCount: supervisor_guidance_requested_at
 *     IS NOT NULL AND status != 'closed'
 *   - awaitingFirstReplyCount: status='new' (untouched
 *     inbound — the most time-sensitive subset)
 *
 * Uses head:true count queries — cheap. Returns null on any
 * error so the page can omit the section instead of showing
 * misleading zeros.
 */
export type CareCommandStats = {
  hasActivity: boolean;
  openCount: number;
  needsGuidanceCount: number;
  awaitingFirstReplyCount: number;
  /** Per TT.md A21 audit (2026-06-18) MED finding — until this,
   *  due durability checks (scheduled 7 days after resolution
   *  per §3.5) had an endpoint (listDueDurabilityChecks) but
   *  NO UI surface. The constitutional loop fired but humans
   *  never saw the prompt to render the verdict. Surfacing
   *  here puts it on the operational hub. */
  dueDurabilityCount: number;
};

export async function fetchCareCommandStats(): Promise<CareCommandStats | null> {
  try {
    const sb = await createServerClient();

    const totalProbe = await sb
      .from("support_conversations")
      .select("id", { count: "exact", head: true });
    if (totalProbe.error) return null;
    const hasActivity = (totalProbe.count ?? 0) > 0;
    if (!hasActivity) {
      return {
        hasActivity: false,
        openCount: 0,
        needsGuidanceCount: 0,
        awaitingFirstReplyCount: 0,
        dueDurabilityCount: 0,
      };
    }

    const openProbe = await sb
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "open", "assigned", "waiting"]);
    const guidanceProbe = await sb
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .not("supervisor_guidance_requested_at", "is", null)
      .neq("status", "closed");
    const newProbe = await sb
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    // §3.5 durability checks scheduled 7+ days ago that the
    // agent hasn't reviewed yet (checked_at IS NULL).
    const durabilityProbe = await sb
      .from("support_durability_checks")
      .select("id", { count: "exact", head: true })
      .is("checked_at", null)
      .lte("scheduled_for", new Date().toISOString());

    return {
      hasActivity: true,
      openCount: openProbe.count ?? 0,
      needsGuidanceCount: guidanceProbe.count ?? 0,
      awaitingFirstReplyCount: newProbe.count ?? 0,
      dueDurabilityCount: durabilityProbe.count ?? 0,
    };
  } catch {
    return null;
  }
}

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
 * Bulk status change — apply the same status to N conversations
 * in a single UPDATE. Used by the inbox bulk-action bar (e.g.,
 * "Archive 5 selected" maps to bulk status='closed').
 *
 * Soft-archive only: the "delete" bulk operation maps to
 * status='closed' so the row + its event chain stay intact for
 * audit / reopening. Hard deletion isn't exposed at the data
 * layer.
 *
 * Returns the number of rows actually updated so the caller can
 * surface "5 archived" vs "3 of 5 archived" (the difference is
 * usually RLS, which silently drops rows the caller can't write
 * to — better to surface that honestly than to lie).
 */
export async function bulkSetConversationStatus(args: {
  ids: string[];
  status: SupportConversation["status"];
}): Promise<number> {
  if (args.ids.length === 0) return 0;
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_conversations")
    .update({ status: args.status })
    .in("id", args.ids)
    .select("id");
  return (data ?? []).length;
}

/**
 * Bulk assign — apply the same targetAgentId (or null to bulk
 * unassign) to N conversations. Same pattern as
 * bulkSetConversationStatus. The route layer is responsible for
 * filtering `ids` to only the conversations the caller is
 * allowed to reassign per the existing permission matrix:
 *   - admin: anything
 *   - agent: own + unclaimed only
 * This function does not enforce that — passing it disallowed
 * ids would still update them. Auth lives at the route.
 */
export async function bulkAssignConversations(args: {
  ids: string[];
  targetAgentId: string | null;
}): Promise<number> {
  if (args.ids.length === 0) return 0;
  const sb = await createServerClient();
  const { data } = await sb
    .from("support_conversations")
    .update({ assigned_agent_id: args.targetAgentId })
    .in("id", args.ids)
    .select("id");
  return (data ?? []).length;
}

/**
 * Reassign an already-claimed conversation to a different agent.
 * Differs from claimConversation in three ways:
 *   1. Does NOT touch status — caller picks an already-claimed
 *      conversation that's mid-conversation; reassignment is just
 *      "different human picks it up from here."
 *   2. Does NOT touch ai_responding — the AI's role was already
 *      decided when the original agent claimed.
 *   3. Accepts targetAgentId=null to UNASSIGN (return to the
 *      Unassigned pool).
 *
 * Auth: route layer must verify the caller is a CEO/COO/admin OR
 * the agent currently assigned (a regular agent can hand off
 * their own conversation but can't steal someone else's).
 */
export async function assignConversationToAgent(args: {
  conversationId: string;
  targetAgentId: string | null;
}): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("support_conversations")
      .update({
        assigned_agent_id: args.targetAgentId,
      })
      .eq("id", args.conversationId)
      .select("id"),
    { context: "assignConversationToAgent" }
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
  /** 0058 — attachment-kind agent messages carry the file
   *  pointer in media_url (assets-v1://{fileId}). Body is the
   *  file's title; the render path resolves the row + signed
   *  download URL on demand. */
  kind?: "message" | "attachment";
  mediaUrl?: string | null;
  mediaType?: string | null;
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
      kind: args.kind ?? "message",
      media_url: args.mediaUrl ?? null,
      media_type: args.mediaType ?? null,
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
  // supervisorGuidanceRequestedAt inherited via SupportConversation
  // (was duplicated here when only EnrichedConversation surfaced
  // it; now baseline so removed).
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
    // supervisorGuidanceRequestedAt comes through via the base
    // mapConversation now that it's a baseline column (was
    // duplicated here when only EnrichedConversation had it).
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

/**
 * Flag a conversation as needing supervisor guidance. Sets
 * supervisor_guidance_requested_at to NOW(). Independent of
 * status — the conversation stays in its current customer-flow
 * state (open / awaiting_customer / etc) while the flag is up.
 *
 * The agent inbox "Needs guidance" filter surfaces every
 * conversation with a non-null timestamp. A supervisor reading
 * the inbox sees the request; once they've responded (typically
 * via an internal note in the thread), they call
 * clearSupervisorGuidanceRequest to dismiss it.
 */
export async function requestSupervisorGuidance(
  conversationId: string
): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("support_conversations")
      .update({ supervisor_guidance_requested_at: new Date().toISOString() })
      .eq("id", conversationId)
      .select("id"),
    { context: "requestSupervisorGuidance" }
  );
}

export async function clearSupervisorGuidanceRequest(
  conversationId: string
): Promise<void> {
  const sb = await createServerClient();
  await strictMutate(
    sb
      .from("support_conversations")
      .update({ supervisor_guidance_requested_at: null })
      .eq("id", conversationId)
      .select("id"),
    { context: "clearSupervisorGuidanceRequest" }
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
 * Phase 7 commit 3 — list resolutions for the knowledge-base
 * surface. §1.1 data-as-asset operationalized as a browsable
 * corpus.
 *
 * Filters: category, capturedBy (agent), outcome (held / reopened
 * / inconclusive). Returns recent first; corpus is small enough
 * today to filter rather than full-text search (§A4 — defer
 * embeddings-based search until the §4 readout shows when the
 * gain is real).
 */
export type KnowledgeResolution = {
  id: string;
  conversationId: string;
  companyId: string;
  capturedBy: string | null;
  capturedByName: string | null;
  issueSummary: string;
  whatWorked: string;
  category: string | null;
  precedentResolutionId: string | null;
  createdAt: string;
  durability: {
    scheduledFor: string;
    checkedAt: string | null;
    outcome: "held" | "reopened" | "inconclusive" | null;
  } | null;
};

export async function listKnowledgeResolutions(args: {
  companyId: string;
  category?: string | null;
  capturedBy?: string | null;
  outcome?: "held" | "reopened" | "inconclusive" | null;
  limit?: number;
}): Promise<{ resolutions: KnowledgeResolution[]; categories: string[] }> {
  const sb = await createServerClient();
  const limit = args.limit ?? 50;

  let query = sb
    .from("support_resolutions")
    .select("*, profiles(full_name)")
    .eq("company_id", args.companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.category) query = query.eq("category", args.category);
  if (args.capturedBy) query = query.eq("captured_by", args.capturedBy);

  const { data: rows } = await query;
  type Row = {
    id: string;
    conversation_id: string;
    company_id: string;
    captured_by: string | null;
    issue_summary: string;
    what_worked: string;
    category: string | null;
    precedent_resolution_id: string | null;
    created_at: string;
    profiles: { full_name: string | null } | null;
  };
  const resolutionRows = (rows ?? []) as Row[];
  const resolutionIds = resolutionRows.map((r) => r.id);

  // Join durability outcomes — each resolution may have a
  // scheduled check that's still pending or has resolved.
  const { data: durs } = await sb
    .from("support_durability_checks")
    .select("resolution_id, scheduled_for, checked_at, outcome")
    .in("resolution_id", resolutionIds.length > 0 ? resolutionIds : ["00000000-0000-0000-0000-000000000000"]);

  type DurRow = {
    resolution_id: string;
    scheduled_for: string;
    checked_at: string | null;
    outcome: "held" | "reopened" | "inconclusive" | null;
  };
  const durByResolution = new Map<string, DurRow>();
  for (const d of (durs ?? []) as DurRow[]) {
    durByResolution.set(d.resolution_id, d);
  }

  const resolutions: KnowledgeResolution[] = resolutionRows
    .map((r) => {
      const d = durByResolution.get(r.id);
      return {
        id: r.id,
        conversationId: r.conversation_id,
        companyId: r.company_id,
        capturedBy: r.captured_by,
        capturedByName: r.profiles?.full_name ?? null,
        issueSummary: r.issue_summary,
        whatWorked: r.what_worked,
        category: r.category,
        precedentResolutionId: r.precedent_resolution_id,
        createdAt: r.created_at,
        durability: d
          ? {
              scheduledFor: d.scheduled_for,
              checkedAt: d.checked_at,
              outcome: d.outcome,
            }
          : null,
      };
    })
    .filter((r) => {
      if (!args.outcome) return true;
      return r.durability?.outcome === args.outcome;
    });

  // Categories for the filter dropdown — all distinct
  // categories the company has used. Separate cheap query.
  const { data: catRows } = await sb
    .from("support_resolutions")
    .select("category")
    .eq("company_id", args.companyId)
    .not("category", "is", null);
  type CatRow = { category: string };
  const categories = Array.from(
    new Set(
      ((catRows ?? []) as CatRow[]).map((c) => c.category).filter(Boolean)
    )
  ).sort();

  return { resolutions, categories };
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
      // sanitize each term before it goes into the raw .or() filter (§A13).
      .map((t) => sanitizeOrIlikeTerm(t))
      .filter((t) => t.length > 0)
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
}): Promise<"recorded" | "already_recorded" | "not_found"> {
  const sb = await createServerClient();
  // WRITE-ONCE (§3.5 / audit 2026-07-09): the durability outcome IS a §3.5
  // consequence metric ("did it reopen?"). Recording it must be one-shot — a
  // second POST would silently overwrite held→reopened, corrupting the held-rate.
  // The due-list only surfaces still-unchecked rows, but this write had NO server
  // guard and always reported success (false-ok). Scope the write to still-unchecked
  // rows (idempotent + race-safe) and report the actual result. Same class as the
  // resolutions-review write-once fix; the care durability table has no freeze
  // trigger, so this code path is the only defense.
  const { data, error } = await sb
    .from("support_durability_checks")
    .update({
      checked_at: new Date().toISOString(),
      outcome: args.outcome,
      notes: args.notes ?? null,
    })
    .eq("id", args.checkId)
    .is("checked_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return "recorded";
  // 0 rows: the check is either not visible to this caller (RLS — wrong company
  // or nonexistent) or already recorded. Distinguish for an honest message; the
  // follow-up read is RLS-scoped, so a peer-tenant id reads as not_found.
  const { data: existing } = await sb
    .from("support_durability_checks")
    .select("id")
    .eq("id", args.checkId)
    .maybeSingle();
  return existing ? "already_recorded" : "not_found";
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
  const { data: checks, error: eChecks } = await sb
    .from("support_durability_checks")
    .select("conversation_id, outcome")
    .eq("company_id", args.companyId)
    .not("outcome", "is", null)
    .gte("checked_at", since)
    .limit(5000);
  // §3.4 honest-error-state (audit 2026-07-09): this is the HEADLINE read. If it
  // failed, do NOT fall through to the empty-cohorts return below as if there were
  // no durability data — throw so the leadership route (which calls this via
  // Promise.all with no try/catch) 500s and the page's existing error state fires,
  // instead of showing a false "no activity" readout.
  if (eChecks) {
    throw new Error(`care coach-rubric readout: durability read failed — ${eChecks.message}`);
  }

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
  const { data: msgs, error: eMsgs } = await sb
    .from("support_messages")
    .select("conversation_id, coach_counts, coach_grade")
    .in("conversation_id", conversationIds)
    .eq("author_type", "agent")
    .eq("is_internal_note", false);
  if (eMsgs) {
    throw new Error(`care coach-rubric readout: message classification read failed — ${eMsgs.message}`);
  }

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

/**
 * §4 Voice value readout — Phase 9 commit 2.
 *
 * The hypothesis under test: do conversations that used voice
 * (at least one customer message arrived via STT) reach
 * resolution durably at comparable or better rates than text-
 * only?
 *
 * Same shape as the Co-Pilot value readout: bucket conversations
 * by whether ANY of their customer messages had medium='voice',
 * compute durability_held rate per bucket.
 *
 * Constitutional sources (consulted per §0.1):
 *   - §A2 — this readout closes the §A2 design-backwards loop
 *     for the voice reframe shipped in commit 1.
 *   - §A3 — measures downstream consequence (durability), not
 *     System agreement (e.g., "did the customer use the voice
 *     feature").
 *   - §A4 — sample sizes surfaced; UI confidence tier handles
 *     the threshold judgment.
 *   - §A11 — counts and rates, never verdicts.
 *   - §A18 — comparison is across MEDIUMS (voice vs text), not
 *     agents.
 */
export type VoiceValueReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    voiceUsed: ReadoutCohort;
    voiceNotUsed: ReadoutCohort;
  };
};

export async function fetchVoiceValueReadout(args: {
  companyId: string;
  windowDays?: number;
}): Promise<VoiceValueReadout> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 60;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

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

  const init = (): ReadoutCohort => ({
    conversationCount: 0,
    durabilityHeld: 0,
    durabilityReopened: 0,
    durabilityInconclusive: 0,
    durabilityHeldRate: null,
  });
  if (checkRows.length === 0) {
    return {
      windowDays,
      companyId: args.companyId,
      cohorts: { voiceUsed: init(), voiceNotUsed: init() },
    };
  }

  const conversationIds = Array.from(
    new Set(checkRows.map((c) => c.conversation_id))
  );

  // Classify each conversation: voiceUsed = ANY customer message
  // had medium='voice'.
  const { data: msgs } = await sb
    .from("support_messages")
    .select("conversation_id, medium")
    .in("conversation_id", conversationIds)
    .eq("author_type", "customer");

  type MsgRow = { conversation_id: string; medium: string | null };
  const voiceByConv = new Set<string>();
  for (const m of (msgs ?? []) as MsgRow[]) {
    if (m.medium === "voice") voiceByConv.add(m.conversation_id);
  }

  const cohorts = { voiceUsed: init(), voiceNotUsed: init() };
  const counted = new Set<string>();
  for (const c of checkRows) {
    const bucket = voiceByConv.has(c.conversation_id)
      ? cohorts.voiceUsed
      : cohorts.voiceNotUsed;
    if (!counted.has(c.conversation_id)) {
      bucket.conversationCount += 1;
      counted.add(c.conversation_id);
    }
    if (c.outcome === "held") bucket.durabilityHeld += 1;
    else if (c.outcome === "reopened") bucket.durabilityReopened += 1;
    else if (c.outcome === "inconclusive") bucket.durabilityInconclusive += 1;
  }
  for (const b of [cohorts.voiceUsed, cohorts.voiceNotUsed]) {
    const total =
      b.durabilityHeld + b.durabilityReopened + b.durabilityInconclusive;
    b.durabilityHeldRate = total > 0 ? b.durabilityHeld / total : null;
  }

  return { windowDays, companyId: args.companyId, cohorts };
}

/**
 * §4 Co-Pilot value readout — do Co-Pilot-assisted replies
 * produce more durable resolutions than unassisted?
 *
 * The co_pilot_invoked column on support_messages was added in
 * migration 0040 specifically so this comparison would be
 * possible without retrospective inference. The readout splits
 * conversations by whether ANY of their agent replies were
 * Co-Pilot-assisted.
 *
 * Same §A2/§A3/§A4 disciplines as the Coach rubric readout.
 * Same caveats: not controlled, not significant, signal not
 * causation.
 */
export type CoPilotValueReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    coPilotUsed: ReadoutCohort;
    coPilotNotUsed: ReadoutCohort;
  };
};

export async function fetchCoPilotValueReadout(args: {
  companyId: string;
  windowDays?: number;
}): Promise<CoPilotValueReadout> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 60;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

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

  const init = (): ReadoutCohort => ({
    conversationCount: 0,
    durabilityHeld: 0,
    durabilityReopened: 0,
    durabilityInconclusive: 0,
    durabilityHeldRate: null,
  });
  if (checkRows.length === 0) {
    return {
      windowDays,
      companyId: args.companyId,
      cohorts: { coPilotUsed: init(), coPilotNotUsed: init() },
    };
  }

  const conversationIds = Array.from(
    new Set(checkRows.map((c) => c.conversation_id))
  );

  // Classify by ANY agent reply with co_pilot_invoked=true.
  const { data: msgs } = await sb
    .from("support_messages")
    .select("conversation_id, co_pilot_invoked")
    .in("conversation_id", conversationIds)
    .eq("author_type", "agent")
    .eq("is_internal_note", false);

  type MsgRow = {
    conversation_id: string;
    co_pilot_invoked: boolean | null;
  };
  const coPilotByConv = new Set<string>();
  for (const m of (msgs ?? []) as MsgRow[]) {
    if (m.co_pilot_invoked) coPilotByConv.add(m.conversation_id);
  }

  const cohorts = {
    coPilotUsed: init(),
    coPilotNotUsed: init(),
  };
  const counted = new Set<string>();
  for (const c of checkRows) {
    const bucket = coPilotByConv.has(c.conversation_id)
      ? cohorts.coPilotUsed
      : cohorts.coPilotNotUsed;
    if (!counted.has(c.conversation_id)) {
      bucket.conversationCount += 1;
      counted.add(c.conversation_id);
    }
    if (c.outcome === "held") bucket.durabilityHeld += 1;
    else if (c.outcome === "reopened") bucket.durabilityReopened += 1;
    else if (c.outcome === "inconclusive") bucket.durabilityInconclusive += 1;
  }
  for (const b of [cohorts.coPilotUsed, cohorts.coPilotNotUsed]) {
    const total =
      b.durabilityHeld + b.durabilityReopened + b.durabilityInconclusive;
    b.durabilityHeldRate = total > 0 ? b.durabilityHeld / total : null;
  }

  return { windowDays, companyId: args.companyId, cohorts };
}

/**
 * §4 Routing readout — do auto-routed conversations resolve
 * with comparable durability to manually-claimed ones?
 *
 * The routing_method column on support_conversations (added in
 * migration 0042) makes this comparison possible. Per §A18 we
 * are NOT comparing per-agent — we're comparing routing METHOD.
 */
export type RoutingReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    autoRouted: ReadoutCohort;
    manualClaim: ReadoutCohort;
    unrouted: ReadoutCohort;
  };
};

export async function fetchRoutingReadout(args: {
  companyId: string;
  windowDays?: number;
}): Promise<RoutingReadout> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 60;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

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

  const init = (): ReadoutCohort => ({
    conversationCount: 0,
    durabilityHeld: 0,
    durabilityReopened: 0,
    durabilityInconclusive: 0,
    durabilityHeldRate: null,
  });
  if (checkRows.length === 0) {
    return {
      windowDays,
      companyId: args.companyId,
      cohorts: {
        autoRouted: init(),
        manualClaim: init(),
        unrouted: init(),
      },
    };
  }

  const conversationIds = Array.from(
    new Set(checkRows.map((c) => c.conversation_id))
  );

  const { data: convs } = await sb
    .from("support_conversations")
    .select("id, routing_method")
    .in("id", conversationIds);

  type ConvRow = { id: string; routing_method: string | null };
  const methodByConv = new Map<string, string | null>();
  for (const c of (convs ?? []) as ConvRow[]) {
    methodByConv.set(c.id, c.routing_method);
  }

  const cohorts = {
    autoRouted: init(),
    manualClaim: init(),
    unrouted: init(),
  };
  const counted = new Set<string>();
  for (const c of checkRows) {
    const method = methodByConv.get(c.conversation_id) ?? null;
    const bucket =
      method === "auto_least_loaded"
        ? cohorts.autoRouted
        : method === "manual_claim" || method === "manual_assign"
          ? cohorts.manualClaim
          : cohorts.unrouted;
    if (!counted.has(c.conversation_id)) {
      bucket.conversationCount += 1;
      counted.add(c.conversation_id);
    }
    if (c.outcome === "held") bucket.durabilityHeld += 1;
    else if (c.outcome === "reopened") bucket.durabilityReopened += 1;
    else if (c.outcome === "inconclusive") bucket.durabilityInconclusive += 1;
  }
  for (const b of [
    cohorts.autoRouted,
    cohorts.manualClaim,
    cohorts.unrouted,
  ]) {
    const total =
      b.durabilityHeld + b.durabilityReopened + b.durabilityInconclusive;
    b.durabilityHeldRate = total > 0 ? b.durabilityHeld / total : null;
  }

  return { windowDays, companyId: args.companyId, cohorts };
}

/**
 * §4 SLA + durability backstop readout — Phase 8 commit 1.
 *
 * The category claim this readout proves: meeting a first-
 * response SLA is incomplete if the resolution reopens. The
 * "fully honored" rate (first-response met AND durability held)
 * is the honest measure of customer success; the standard SLA
 * metric is the comparison.
 *
 * Constitutional sources:
 *   - §A2 — this readout IS the §4 evidence for the
 *     "SLA + durability backstop" constitutional reframe.
 *   - §A3 — measures downstream consequence (durability), not
 *     System agreement.
 *   - §A4 — sample sizes surfaced, confidence tier in the UI.
 *   - §A11 — counts and rates, never verdicts.
 *   - §A18 — no per-agent breakdown. The comparison is across
 *     METRICS not agents.
 *   - §1.6 close-the-loop — the readout connects first response
 *     (start) to durability (end) into a single honest metric.
 *
 * For each conversation that was resolved AND had a completed
 * durability check in the window:
 *   - firstResponseMet — first_response_at − first_message_at ≤
 *     sla_first_response_minutes
 *   - durabilityHeld — durability_check.outcome === 'held'
 *   - fullyHonored — both
 *   - falseSlaSuccesses — firstResponseMet AND durability =
 *     reopened. THIS is the failure mode the standard SLA hides.
 */
export type SlaWithDurabilityReadout = {
  windowDays: number;
  companyId: string;
  totalConversations: number;
  firstResponseMet: number;
  firstResponseMetRate: number | null;
  durabilityHeld: number;
  durabilityHeldRate: number | null;
  fullyHonored: number;
  fullyHonoredRate: number | null;
  /** First response met but durability reopened — the standard-
   *  SLA blind spot. THIS is the number that proves the
   *  constitutional reframe matters. */
  falseSlaSuccesses: number;
  falseSlaSuccessesRate: number | null;
};

export async function fetchSlaWithDurabilityReadout(args: {
  companyId: string;
  windowDays?: number;
}): Promise<SlaWithDurabilityReadout> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 60;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // Pull resolved-with-durability-checked conversations in the window.
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
    return {
      windowDays,
      companyId: args.companyId,
      totalConversations: 0,
      firstResponseMet: 0,
      firstResponseMetRate: null,
      durabilityHeld: 0,
      durabilityHeldRate: null,
      fullyHonored: 0,
      fullyHonoredRate: null,
      falseSlaSuccesses: 0,
      falseSlaSuccessesRate: null,
    };
  }

  const conversationIds = Array.from(
    new Set(checkRows.map((c) => c.conversation_id))
  );

  const { data: convs } = await sb
    .from("support_conversations")
    .select(
      "id, first_message_at, first_response_at, sla_first_response_minutes"
    )
    .in("id", conversationIds);

  type ConvRow = {
    id: string;
    first_message_at: string | null;
    first_response_at: string | null;
    sla_first_response_minutes: number | null;
  };
  const convByConv = new Map<string, ConvRow>();
  for (const c of (convs ?? []) as ConvRow[]) {
    convByConv.set(c.id, c);
  }

  // Dedupe to one row per conversation (a conversation has
  // exactly one durability check after 0036's auto-schedule).
  const seen = new Set<string>();
  let firstResponseMet = 0;
  let durabilityHeld = 0;
  let fullyHonored = 0;
  let falseSlaSuccesses = 0;
  let totalConversations = 0;

  for (const c of checkRows) {
    if (seen.has(c.conversation_id)) continue;
    seen.add(c.conversation_id);
    totalConversations += 1;

    const conv = convByConv.get(c.conversation_id);
    const slaMinutes = conv?.sla_first_response_minutes ?? 60;
    const responseMet =
      conv?.first_message_at &&
      conv?.first_response_at &&
      new Date(conv.first_response_at).getTime() -
        new Date(conv.first_message_at).getTime() <=
        slaMinutes * 60_000;
    const held = c.outcome === "held";

    if (responseMet) firstResponseMet += 1;
    if (held) durabilityHeld += 1;
    if (responseMet && held) fullyHonored += 1;
    if (responseMet && c.outcome === "reopened") falseSlaSuccesses += 1;
  }

  const rate = (n: number, d: number) => (d > 0 ? n / d : null);

  return {
    windowDays,
    companyId: args.companyId,
    totalConversations,
    firstResponseMet,
    firstResponseMetRate: rate(firstResponseMet, totalConversations),
    durabilityHeld,
    durabilityHeldRate: rate(durabilityHeld, totalConversations),
    fullyHonored,
    fullyHonoredRate: rate(fullyHonored, totalConversations),
    falseSlaSuccesses,
    falseSlaSuccessesRate: rate(falseSlaSuccesses, totalConversations),
  };
}

/**
 * §4 Pattern-resolution readout — Phase 8 commit 2.
 *
 * The constitutional question this answers: does a detected
 * pattern's existence accelerate resolution AFTER it was
 * surfaced (vs BEFORE, when the team had no compounding
 * institutional knowledge for that category)?
 *
 * Method (per pattern category):
 *   1. Sort all resolutions in the category by created_at
 *   2. The "pattern formed at" cutoff = the 3rd resolution's
 *      created_at — the moment it crossed the §3.2 threshold
 *      and the team had three precedents to draw on. Categories
 *      with < 3 resolutions ever are skipped (no pattern yet).
 *   3. For all conversations with resolutions in this category:
 *      - Bucket BEFORE if resolved_at < cutoff
 *      - Bucket AT/AFTER if resolved_at >= cutoff
 *   4. For each bucket: count + median time-to-resolve +
 *      durability_held rate
 *
 * §A4 uncertainties surfaced in the UI:
 *   - Confound: "before" conversations are earlier-in-time
 *     resolutions and may reflect general team inexperience,
 *     not just the absence of pattern memory.
 *   - The 3rd-resolution cutoff is itself an §A4 choice. The §4
 *     readout will refine.
 *
 * §A11 — counts and rates. The user renders the verdict on
 * whether the difference is meaningful per pattern.
 * §A18 — no per-agent breakdown. Patterns are team properties.
 */
export type PatternResolutionReadout = {
  windowDays: number;
  companyId: string;
  patterns: Array<{
    category: string;
    patternFormedAt: string;
    totalResolutions: number;
    before: PatternBucket;
    after: PatternBucket;
  }>;
};

export type PatternBucket = {
  conversationCount: number;
  medianTimeToResolveMinutes: number | null;
  durabilityHeld: number;
  durabilityChecked: number;
  durabilityHeldRate: number | null;
};

export async function fetchPatternResolutionReadout(args: {
  companyId: string;
  windowDays?: number;
}): Promise<PatternResolutionReadout> {
  const sb = await createServerClient();
  const windowDays = args.windowDays ?? 90;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1. Pull all resolutions for the company in the window.
  const { data: resolutionRows } = await sb
    .from("support_resolutions")
    .select("id, conversation_id, category, created_at")
    .eq("company_id", args.companyId)
    .not("category", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);

  type ResRow = {
    id: string;
    conversation_id: string;
    category: string;
    created_at: string;
  };
  const resRows = (resolutionRows ?? []) as ResRow[];

  // 2. Group by category, find the 3rd-resolution cutoff.
  type CategoryGroup = {
    cutoff: string;
    resolutions: ResRow[];
  };
  const byCategory = new Map<string, CategoryGroup>();
  const allByCategory = new Map<string, ResRow[]>();
  for (const r of resRows) {
    const arr = allByCategory.get(r.category) ?? [];
    arr.push(r);
    allByCategory.set(r.category, arr);
  }
  for (const [category, arr] of allByCategory) {
    if (arr.length < 3) continue;
    // arr is already sorted by created_at asc.
    byCategory.set(category, {
      cutoff: arr[2]!.created_at,
      resolutions: arr,
    });
  }

  if (byCategory.size === 0) {
    return { windowDays, companyId: args.companyId, patterns: [] };
  }

  // 3. Pull the conversations for all the resolutions we're
  //    grouping. We need first_message_at + resolved_at to
  //    compute time-to-resolve.
  const conversationIds = Array.from(
    new Set(
      Array.from(byCategory.values()).flatMap((g) =>
        g.resolutions.map((r) => r.conversation_id)
      )
    )
  );
  const { data: convs } = await sb
    .from("support_conversations")
    .select("id, first_message_at, resolved_at")
    .in("id", conversationIds);

  type ConvRow = {
    id: string;
    first_message_at: string | null;
    resolved_at: string | null;
  };
  const convById = new Map<string, ConvRow>();
  for (const c of (convs ?? []) as ConvRow[]) {
    convById.set(c.id, c);
  }

  // 4. Pull durability checks for the same conversations.
  const { data: durs } = await sb
    .from("support_durability_checks")
    .select("conversation_id, outcome")
    .in("conversation_id", conversationIds)
    .not("outcome", "is", null);

  type DurRow = {
    conversation_id: string;
    outcome: "held" | "reopened" | "inconclusive";
  };
  const durByConv = new Map<string, DurRow>();
  for (const d of (durs ?? []) as DurRow[]) {
    durByConv.set(d.conversation_id, d);
  }

  // 5. For each category group: bucket before/after by
  //    resolved_at vs cutoff. Aggregate stats per bucket.
  const initBucket = (): PatternBucket => ({
    conversationCount: 0,
    medianTimeToResolveMinutes: null,
    durabilityHeld: 0,
    durabilityChecked: 0,
    durabilityHeldRate: null,
  });
  const computeMedian = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    return sorted[mid]!;
  };

  const patterns: PatternResolutionReadout["patterns"] = [];

  for (const [category, group] of byCategory) {
    const before = initBucket();
    const after = initBucket();
    const beforeTimes: number[] = [];
    const afterTimes: number[] = [];

    const seen = new Set<string>();
    for (const r of group.resolutions) {
      if (seen.has(r.conversation_id)) continue;
      seen.add(r.conversation_id);
      const conv = convById.get(r.conversation_id);
      if (!conv) continue;

      const beforePattern = r.created_at < group.cutoff;
      const bucket = beforePattern ? before : after;
      const times = beforePattern ? beforeTimes : afterTimes;

      bucket.conversationCount += 1;
      if (conv.first_message_at && conv.resolved_at) {
        const minutes =
          (new Date(conv.resolved_at).getTime() -
            new Date(conv.first_message_at).getTime()) /
          60_000;
        if (minutes >= 0) times.push(minutes);
      }
      const d = durByConv.get(r.conversation_id);
      if (d) {
        bucket.durabilityChecked += 1;
        if (d.outcome === "held") bucket.durabilityHeld += 1;
      }
    }

    before.medianTimeToResolveMinutes = computeMedian(beforeTimes);
    after.medianTimeToResolveMinutes = computeMedian(afterTimes);
    before.durabilityHeldRate =
      before.durabilityChecked > 0
        ? before.durabilityHeld / before.durabilityChecked
        : null;
    after.durabilityHeldRate =
      after.durabilityChecked > 0
        ? after.durabilityHeld / after.durabilityChecked
        : null;

    patterns.push({
      category,
      patternFormedAt: group.cutoff,
      totalResolutions: group.resolutions.length,
      before,
      after,
    });
  }

  // Sort by total resolutions desc — leaders see the biggest
  // patterns first.
  patterns.sort((a, b) => b.totalResolutions - a.totalResolutions);

  return { windowDays, companyId: args.companyId, patterns };
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
