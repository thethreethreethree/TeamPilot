import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { loadUserContext } from "./userContext";

/**
 * Team Chat data layer.
 *
 * Phase 1 scope: topics, messages, participants, pins. All four with the
 * familiar mode discriminator so the UI handles demo / live-empty / live-data
 * the same way other surfaces do.
 *
 * Demo mode is fully usable — messages persist to localStorage so the UI is
 * reviewable end-to-end without Supabase.
 */

export type ChatTopicStatus = "open" | "closed" | "archived";

export interface ChatTopic {
  id: string;
  title: string;
  description: string | null;
  status: ChatTopicStatus;
  problemId: string | null;
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
  closeSummary: string | null;
  closeDurability: "held" | "reopened" | "partial" | "unknown" | null;
  tags: string[];
  participantCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  /** Conversational Coach v1 opt-in flag — see migration 0019.
   *  Defaults to false; topics created before 0019 backfill to false. */
  coachEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  topicId: string;
  authorId: string | null;
  authorName: string;
  kind: "message" | "system" | "summary" | "voice" | "attachment";
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  replyToId: string | null;
  aiAssisted: boolean;
  createdAt: string;
  pinned: boolean;
}

export interface ChatParticipant {
  userId: string;
  name: string;
  role: "admin" | "member" | "observer";
  joinedAt: string;
  leftAt: string | null;
  messageCount: number;
  lastSeenAt: string | null;
}

export type ChatsMode = "demo-fixtures" | "live-empty" | "live-data";

// ─── Demo fixtures + localStorage state ──────────────────────

const STORAGE_KEY = "execos.chat.v1";

interface DemoState {
  topics: ChatTopic[];
  messages: Record<string, ChatMessage[]>;
  participants: Record<string, ChatParticipant[]>;
}

const DEMO_USER_ID = "demo-current-user";
const DEMO_USER_NAME = "You (Demo)";

const seedDemoState = (): DemoState => ({
  topics: [
    {
      id: "demo-topic-finance",
      title: "Tracking Q3 financial growth",
      description:
        "Working group monitoring revenue, runway, and forecast accuracy heading into the board update.",
      status: "open",
      problemId: null,
      createdBy: "demo-cfo",
      createdAt: "2025-05-29T09:00:00Z",
      closedAt: null,
      closedBy: null,
      closeSummary: null,
      closeDurability: null,
      tags: ["finance", "board", "Q3"],
      participantCount: 4,
      messageCount: 5,
      lastMessageAt: "2025-05-31T15:32:00Z",
      coachEnabled: false,
    },
    {
      id: "demo-topic-bottleneck",
      title: "Payment gateway integration — root cause",
      description:
        "Cross-team conversation to surface why the gateway integration has been blocked three weeks running.",
      status: "open",
      problemId: null,
      createdBy: "demo-coo",
      createdAt: "2025-05-30T10:15:00Z",
      closedAt: null,
      closedBy: null,
      closeSummary: null,
      closeDurability: null,
      tags: ["engineering", "operations"],
      participantCount: 3,
      messageCount: 3,
      lastMessageAt: "2025-05-31T11:10:00Z",
      coachEnabled: false,
    },
    {
      id: "demo-topic-resolved",
      title: "Approval workflow redesign",
      description:
        "Closed — landed the single-owner-per-approval model. Cycle time dropped from 3d to 18h.",
      status: "closed",
      problemId: null,
      createdBy: "demo-coo",
      createdAt: "2025-04-10T09:00:00Z",
      closedAt: "2025-05-08T14:00:00Z",
      closedBy: "demo-coo",
      closeSummary:
        "Assigned a single owner for cross-team approvals with a 24-hour SLA. Validated by reduced cycle time across four weeks.",
      closeDurability: "held",
      tags: ["operations", "approvals"],
      participantCount: 5,
      messageCount: 4,
      lastMessageAt: "2025-05-08T14:00:00Z",
      coachEnabled: false,
    },
  ],
  messages: {
    "demo-topic-finance": [
      {
        id: "m1",
        topicId: "demo-topic-finance",
        authorId: "demo-cfo",
        authorName: "Sarah Kim (CFO)",
        kind: "message",
        body: "Kicking this off ahead of the board update. I want us to track three numbers: MRR, runway, and the gap between forecast and actuals.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-05-29T09:01:00Z",
        pinned: true,
      },
      {
        id: "m2",
        topicId: "demo-topic-finance",
        authorId: "demo-ceo",
        authorName: "Alex Park (CEO)",
        kind: "message",
        body: "Agreed. I'd also like us to be explicit about which assumptions in the forecast we are still confident in versus which ones we are not.",
        mediaUrl: null,
        mediaType: null,
        replyToId: "m1",
        aiAssisted: false,
        createdAt: "2025-05-29T09:14:00Z",
        pinned: false,
      },
      {
        id: "m3",
        topicId: "demo-topic-finance",
        authorId: "demo-vp",
        authorName: "Marcus Chen (VP Ops)",
        kind: "message",
        body: "From an ops standpoint, the biggest swing factor is cloud-cost. April came in 12% over forecast. I have a write-up.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-05-30T10:22:00Z",
        pinned: true,
      },
      {
        id: "m4",
        topicId: "demo-topic-finance",
        authorId: "demo-cfo",
        authorName: "Sarah Kim (CFO)",
        kind: "summary",
        body: "Summary so far (System's read — confirm or correct):\n• Tracking three metrics: MRR, runway, forecast-actuals gap.\n• CEO requested explicit assumption flagging.\n• Cloud-cost is the highest-impact open variable (April +12%).",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: true,
        createdAt: "2025-05-30T11:00:00Z",
        pinned: false,
      },
      {
        id: "m5",
        topicId: "demo-topic-finance",
        authorId: "demo-current-user",
        authorName: "You (Demo)",
        kind: "message",
        body: "Confirmed. I'll add a fourth metric: gross margin trend. Worth tracking alongside runway.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: true,
        createdAt: "2025-05-31T15:32:00Z",
        pinned: false,
      },
    ],
    "demo-topic-bottleneck": [
      {
        id: "b1",
        topicId: "demo-topic-bottleneck",
        authorId: "demo-coo",
        authorName: "Lena Torres (COO)",
        kind: "message",
        body: "Gateway is now blocked three weeks running. I do not think this is a technical issue — what am I missing?",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-05-30T10:15:00Z",
        pinned: true,
      },
      {
        id: "b2",
        topicId: "demo-topic-bottleneck",
        authorId: "demo-eng",
        authorName: "James Okafor (Eng Lead)",
        kind: "message",
        body: "From engineering's side the API integration is ready. We are blocked on credentials approval from finance. Have been for 16 days.",
        mediaUrl: null,
        mediaType: null,
        replyToId: "b1",
        aiAssisted: false,
        createdAt: "2025-05-30T10:42:00Z",
        pinned: true,
      },
      {
        id: "b3",
        topicId: "demo-topic-bottleneck",
        authorId: "demo-coo",
        authorName: "Lena Torres (COO)",
        kind: "message",
        body: "That is the same pattern as the approval problem we just resolved last month. Worth looking at how we solved that.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-05-31T11:10:00Z",
        pinned: false,
      },
    ],
    "demo-topic-resolved": [
      {
        id: "r1",
        topicId: "demo-topic-resolved",
        authorId: "demo-coo",
        authorName: "Lena Torres (COO)",
        kind: "message",
        body: "Approvals taking 3+ days across teams. Need a structural fix, not a workaround.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-04-10T09:01:00Z",
        pinned: false,
      },
      {
        id: "r2",
        topicId: "demo-topic-resolved",
        authorId: "demo-current-user",
        authorName: "You (Demo)",
        kind: "message",
        body: "Proposing: single owner per approval category with 24-hour SLA. Diffusion of responsibility is what is producing the 3-day cycle.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-04-10T11:30:00Z",
        pinned: true,
      },
      {
        id: "r3",
        topicId: "demo-topic-resolved",
        authorId: "demo-cfo",
        authorName: "Sarah Kim (CFO)",
        kind: "message",
        body: "Concur. Will pilot in finance for two weeks before rolling.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-04-10T13:15:00Z",
        pinned: false,
      },
      {
        id: "r4",
        topicId: "demo-topic-resolved",
        authorId: "demo-coo",
        authorName: "Lena Torres (COO)",
        kind: "system",
        body: "Topic closed: Assigned a single owner for cross-team approvals with a 24-hour SLA. Validated by reduced cycle time across four weeks.",
        mediaUrl: null,
        mediaType: null,
        replyToId: null,
        aiAssisted: false,
        createdAt: "2025-05-08T14:00:00Z",
        pinned: false,
      },
    ],
  },
  participants: {
    "demo-topic-finance": [
      { userId: "demo-cfo", name: "Sarah Kim (CFO)", role: "admin", joinedAt: "2025-05-29T09:00:00Z", leftAt: null, messageCount: 2, lastSeenAt: "2025-05-30T11:00:00Z" },
      { userId: "demo-ceo", name: "Alex Park (CEO)", role: "member", joinedAt: "2025-05-29T09:00:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-05-29T09:14:00Z" },
      { userId: "demo-vp", name: "Marcus Chen (VP Ops)", role: "member", joinedAt: "2025-05-29T09:00:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-05-30T10:22:00Z" },
      { userId: DEMO_USER_ID, name: DEMO_USER_NAME, role: "member", joinedAt: "2025-05-29T09:00:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-05-31T15:32:00Z" },
    ],
    "demo-topic-bottleneck": [
      { userId: "demo-coo", name: "Lena Torres (COO)", role: "admin", joinedAt: "2025-05-30T10:15:00Z", leftAt: null, messageCount: 2, lastSeenAt: "2025-05-31T11:10:00Z" },
      { userId: "demo-eng", name: "James Okafor (Eng Lead)", role: "member", joinedAt: "2025-05-30T10:15:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-05-30T10:42:00Z" },
      { userId: DEMO_USER_ID, name: DEMO_USER_NAME, role: "member", joinedAt: "2025-05-30T10:15:00Z", leftAt: null, messageCount: 0, lastSeenAt: null },
    ],
    "demo-topic-resolved": [
      { userId: "demo-coo", name: "Lena Torres (COO)", role: "admin", joinedAt: "2025-04-10T09:00:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-05-08T14:00:00Z" },
      { userId: "demo-cfo", name: "Sarah Kim (CFO)", role: "member", joinedAt: "2025-04-10T09:00:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-04-10T13:15:00Z" },
      { userId: DEMO_USER_ID, name: DEMO_USER_NAME, role: "member", joinedAt: "2025-04-10T09:00:00Z", leftAt: null, messageCount: 1, lastSeenAt: "2025-04-10T11:30:00Z" },
    ],
  },
});

function readDemoState(): DemoState {
  if (typeof window === "undefined") return seedDemoState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedDemoState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as DemoState;
  } catch {
    return seedDemoState();
  }
}

function writeDemoState(state: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* full/disabled — silent */
  }
}

export function resetDemoChats(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function demoUserId(): string {
  return DEMO_USER_ID;
}

// ─── Public fetchers ────────────────────────────────────────

export async function fetchTopics(): Promise<{
  topics: ChatTopic[];
  mode: ChatsMode;
}> {
  if (!supabaseEnabled) {
    return { topics: readDemoState().topics, mode: "demo-fixtures" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_topics")
    .select(
      "id, title, description, status, problem_id, created_by, created_at, closed_at, closed_by, close_summary, close_durability, tags, coach_enabled"
    )
    .order("created_at", { ascending: false });
  if (error || !data) return { topics: [], mode: "live-empty" };

  const topics: ChatTopic[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    problemId: row.problem_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closeSummary: row.close_summary,
    closeDurability: row.close_durability,
    tags: row.tags ?? [],
    participantCount: 0,
    messageCount: 0,
    lastMessageAt: null,
    coachEnabled: row.coach_enabled ?? false,
  }));
  return {
    topics,
    mode: topics.length === 0 ? "live-empty" : "live-data",
  };
}

/**
 * Flip the Conversational Coach on/off for a topic.
 *
 * RLS on chat_topics already allows company members to update — we
 * gate this further in the UI to topic admins only, since the toggle
 * affects everyone's composer experience in the topic. The §4 readout
 * sees the toggle indirectly via coach_enabled at the topic level
 * (coached vs uncoached topic outcomes are the consequence measure).
 *
 * Emits a chain event so the §4 readout can attribute later outcomes
 * to "Coach was active during the conversation" rather than blanket
 * topic-level state — a topic that flips between coached and
 * uncoached during its life is a confound to track.
 */
export async function toggleCoach(
  topicId: string,
  enabled: boolean
): Promise<void> {
  if (!supabaseEnabled) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_topics")
    .update({ coach_enabled: enabled })
    .eq("id", topicId);
  if (error) throw new Error(error.message);
  // Fire-and-forget audit event. Non-fatal.
  void (async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.company_id) return;
    await supabase.from("events").insert({
      company_id: profile.company_id,
      actor: auth.user.id,
      kind: enabled ? "coach.enabled" : "coach.disabled",
      subject: `chat_topic:${topicId}`,
      payload: { enabled },
    });
  })();
}

export async function fetchTopic(id: string): Promise<ChatTopic | null> {
  if (!supabaseEnabled) {
    return readDemoState().topics.find((t) => t.id === id) ?? null;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_topics")
    .select(
      "id, title, description, status, problem_id, created_by, created_at, closed_at, closed_by, close_summary, close_durability, tags, coach_enabled"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    problemId: data.problem_id,
    createdBy: data.created_by,
    createdAt: data.created_at,
    closedAt: data.closed_at,
    closedBy: data.closed_by,
    closeSummary: data.close_summary,
    closeDurability: data.close_durability,
    tags: data.tags ?? [],
    participantCount: 0,
    messageCount: 0,
    lastMessageAt: null,
    coachEnabled: data.coach_enabled ?? false,
  };
}

/**
 * Batch-resolve a set of auth user IDs to display names from `profiles`.
 *
 * Why a separate query instead of an embedded select: chat_messages.author_id
 * references auth.users(id), not profiles(id) — even though they share the
 * same UUIDs, PostgREST won't auto-detect the relationship. Doing a single
 * follow-up query on profiles is simpler than declaring a manual relationship
 * hint and survives schema evolution.
 *
 * Falls back to "Unknown" for any id we can't resolve (deleted profile,
 * system-emitted row, etc.) — never leaks the raw UUID into the UI.
 */
async function resolveAuthorNames(
  supabase: ReturnType<typeof createClient>,
  authorIds: Array<string | null>
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(authorIds.filter((x): x is string => typeof x === "string"))
  );
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  return new Map(
    (data ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""])
  );
}

export async function fetchMessages(topicId: string): Promise<ChatMessage[]> {
  if (!supabaseEnabled) {
    return readDemoState().messages[topicId] ?? [];
  }
  const supabase = createClient();
  // Fetch messages, pins, and the name index in parallel — they don't
  // depend on each other. Three queries, one round trip's worth of
  // wall-clock time.
  const [msgRes, pinRes] = await Promise.all([
    supabase
      .from("chat_messages")
      .select(
        "id, topic_id, author_id, kind, body, media_url, media_type, reply_to_id, ai_assisted, created_at"
      )
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true }),
    // Pins join — without this, every reload shows messages as
    // unpinned even when the row exists in chat_pins. §1.7 audit
    // caught this when the optimistic pin UI exposed the bug.
    supabase
      .from("chat_pins")
      .select("message_id")
      .eq("topic_id", topicId),
  ]);
  const data = msgRes.data;
  if (!data) return [];

  const nameById = await resolveAuthorNames(
    supabase,
    data.map((m) => m.author_id as string | null)
  );
  const pinnedIds = new Set(
    (pinRes.data ?? []).map((p) => p.message_id as string)
  );

  return data.map((m) => {
    const isSummary = m.kind === "summary";
    return {
      id: m.id,
      topicId: m.topic_id,
      authorId: m.author_id,
      authorName: isSummary
        ? "System summary"
        : (m.author_id && nameById.get(m.author_id)) || "Unknown",
      kind: m.kind,
      body: m.body,
      mediaUrl: m.media_url,
      mediaType: m.media_type,
      replyToId: m.reply_to_id,
      aiAssisted: m.ai_assisted,
      createdAt: m.created_at,
      pinned: pinnedIds.has(m.id),
    };
  });
}

export async function fetchParticipants(
  topicId: string
): Promise<ChatParticipant[]> {
  if (!supabaseEnabled) {
    return readDemoState().participants[topicId] ?? [];
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_participants")
    .select("user_id, role, joined_at, left_at, message_count, last_seen_at")
    .eq("topic_id", topicId);
  if (!data) return [];

  const nameById = await resolveAuthorNames(
    supabase,
    data.map((p) => p.user_id as string)
  );

  return data.map((p) => ({
    userId: p.user_id,
    name: nameById.get(p.user_id) || "Unknown",
    role: p.role,
    joinedAt: p.joined_at,
    leftAt: p.left_at,
    messageCount: p.message_count,
    lastSeenAt: p.last_seen_at,
  }));
}

/**
 * Add existing company members to a chat topic.
 *
 * Used by the in-chat "Invite" affordance — different semantic action
 * from the team-invitation flow. Team invitations onboard NEW people
 * to the company via email + invite link. This adds people who already
 * have accounts to the topic's participant roster, granting them read
 * + write per the §3.1 RLS rules (`chat_messages` is gated to active
 * participants of the topic).
 *
 * Upsert handles re-join: if a user was a participant previously but
 * marked `left_at`, this clears `left_at` and refreshes `joined_at` so
 * they don't appear as having left the conversation when re-added.
 */
export async function addParticipantsToTopic(
  topicId: string,
  userIds: string[]
): Promise<{ added: number }> {
  if (userIds.length === 0) return { added: 0 };
  if (!supabaseEnabled) return { added: userIds.length };
  const supabase = createClient();
  const rows = userIds.map((user_id) => ({
    topic_id: topicId,
    user_id,
    role: "member" as const,
    joined_at: new Date().toISOString(),
    left_at: null as string | null,
  }));
  const { error } = await supabase
    .from("chat_participants")
    .upsert(rows, { onConflict: "topic_id,user_id" });
  if (error) throw new Error(error.message);
  return { added: userIds.length };
}

// ─── Demo-mode writes ───────────────────────────────────────

export function demoPostMessage(args: {
  topicId: string;
  body: string;
  aiAssisted?: boolean;
  /** Optional message kind. Defaults to "message". Use "summary" for
   *  AI-generated thread summaries (§3.3 framed as the System's read). */
  kind?: ChatMessage["kind"];
  /** Override the author display for non-human posts (e.g. summary). */
  authorName?: string;
}): ChatMessage {
  const state = readDemoState();
  const now = new Date().toISOString();
  const isSummary = args.kind === "summary";
  const msg: ChatMessage = {
    id: `m-${now}-${Math.floor(performance.now())}`,
    topicId: args.topicId,
    authorId: isSummary ? null : DEMO_USER_ID,
    authorName: args.authorName ?? (isSummary ? "System summary" : DEMO_USER_NAME),
    kind: args.kind ?? "message",
    body: args.body,
    mediaUrl: null,
    mediaType: null,
    replyToId: null,
    aiAssisted: args.aiAssisted ?? isSummary,
    createdAt: now,
    pinned: false,
  };
  const list = state.messages[args.topicId] ?? [];
  list.push(msg);
  state.messages[args.topicId] = list;

  // Touch topic counters + participant stats
  const topic = state.topics.find((t) => t.id === args.topicId);
  if (topic) {
    topic.messageCount += 1;
    topic.lastMessageAt = now;
  }
  const pList = state.participants[args.topicId] ?? [];
  const me = pList.find((p) => p.userId === DEMO_USER_ID);
  if (me) {
    me.messageCount += 1;
    me.lastSeenAt = now;
  }
  writeDemoState(state);
  return msg;
}

export function demoCreateTopic(args: {
  title: string;
  description: string;
  tags: string[];
}): ChatTopic {
  const state = readDemoState();
  const now = new Date().toISOString();
  const topic: ChatTopic = {
    id: `topic-${now}`,
    title: args.title,
    description: args.description,
    status: "open",
    problemId: null,
    createdBy: DEMO_USER_ID,
    createdAt: now,
    closedAt: null,
    closedBy: null,
    closeSummary: null,
    closeDurability: null,
    tags: args.tags,
    participantCount: 1,
    messageCount: 0,
    lastMessageAt: null,
      coachEnabled: false,
  };
  state.topics.unshift(topic);
  state.messages[topic.id] = [];
  state.participants[topic.id] = [
    {
      userId: DEMO_USER_ID,
      name: DEMO_USER_NAME,
      role: "admin",
      joinedAt: now,
      leftAt: null,
      messageCount: 0,
      lastSeenAt: now,
    },
  ];
  writeDemoState(state);
  return topic;
}

export function demoTogglePin(args: {
  topicId: string;
  messageId: string;
}): boolean {
  const state = readDemoState();
  const list = state.messages[args.topicId] ?? [];
  const msg = list.find((m) => m.id === args.messageId);
  if (!msg) return false;
  msg.pinned = !msg.pinned;
  writeDemoState(state);
  return msg.pinned;
}

// ─── Unified writes (live + demo) ──────────────────────────────
//
// These wrappers replace direct calls to the demo* functions in pages.
// In live mode they hit Supabase respecting RLS; in demo mode they
// delegate to the localStorage demo* helpers.
//
// Why unified, not per-mode at the call site: the moment a page does
// `if (supabaseEnabled) liveCreate() else demoCreate()` you have to
// remember to keep both branches in sync. Centralizing the switch
// here means callers say `createTopic(...)` and never branch.

// `getMyCompanyId` was removed in favour of the session-scoped
// `loadUserContext()` cache. See src/lib/data/userContext.ts for the
// rationale (§1.7 R1 audit finding — cut 2 round trips per chat write).

export async function createTopic(args: {
  title: string;
  description: string;
  tags: string[];
}): Promise<ChatTopic> {
  if (!supabaseEnabled) {
    return demoCreateTopic(args);
  }
  const ctx = await loadUserContext();
  const supabase = createClient();

  // Insert the topic. RLS validates company_id == auth_company_id().
  const { data: topicRow, error: topicErr } = await supabase
    .from("chat_topics")
    .insert({
      company_id: ctx.companyId,
      title: args.title,
      description: args.description || null,
      tags: args.tags,
      created_by: ctx.userId,
    })
    .select(
      "id, title, description, status, problem_id, created_by, created_at, closed_at, closed_by, close_summary, close_durability, tags, coach_enabled"
    )
    .single();
  if (topicErr || !topicRow) {
    throw new Error(topicErr?.message ?? "Topic create failed.");
  }

  // Add creator as admin participant. Without this row, RLS forbids
  // the creator from posting messages (insert policy requires being a
  // current participant). We intentionally do this AFTER the topic row
  // so a permission failure here leaves a topic the user can still
  // see in the list but not post to — surfaceable, not silent.
  const { error: pErr } = await supabase.from("chat_participants").insert({
    topic_id: topicRow.id,
    user_id: ctx.userId,
    role: "admin",
  });
  if (pErr) {
    // Topic exists but participation didn't take. Surface honestly.
    throw new Error(
      `Topic created but admin participation failed: ${pErr.message}. Re-open the topic from the list once the issue is resolved.`
    );
  }

  return {
    id: topicRow.id,
    title: topicRow.title,
    description: topicRow.description,
    status: topicRow.status,
    problemId: topicRow.problem_id,
    createdBy: topicRow.created_by,
    createdAt: topicRow.created_at,
    closedAt: topicRow.closed_at,
    closedBy: topicRow.closed_by,
    closeSummary: topicRow.close_summary,
    closeDurability: topicRow.close_durability,
    tags: topicRow.tags ?? [],
    participantCount: 1,
    messageCount: 0,
    lastMessageAt: null,
      coachEnabled: false,
  };
}

export async function postMessage(args: {
  topicId: string;
  body: string;
  aiAssisted?: boolean;
  kind?: ChatMessage["kind"];
  authorName?: string;
}): Promise<ChatMessage> {
  if (!supabaseEnabled) {
    return demoPostMessage(args);
  }
  const ctx = await loadUserContext();
  const supabase = createClient();

  // We use ctx.companyId rather than re-fetching from chat_topics. The user
  // can only post into topics that share their auth_company_id() (enforced
  // by RLS), so the two are guaranteed equal in any path that reaches here.
  // Skipping the topic lookup eliminates one round trip per post.
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      topic_id: args.topicId,
      company_id: ctx.companyId,
      author_id: ctx.userId,
      kind: args.kind ?? "message",
      body: args.body,
      ai_assisted: args.aiAssisted ?? args.kind === "summary",
    })
    .select(
      "id, topic_id, author_id, kind, body, media_url, media_type, reply_to_id, ai_assisted, created_at"
    )
    .single();
  if (error || !data) throw new Error(error?.message ?? "Post failed.");

  // Resolve poster's display name. Override beats summary-system-author
  // beats cached profile name beats email. The cached full_name in ctx
  // saves the profile lookup that used to run per-post.
  let resolvedName: string;
  if (args.authorName) {
    resolvedName = args.authorName;
  } else if (args.kind === "summary") {
    resolvedName = "System summary";
  } else {
    resolvedName = ctx.fullName || ctx.email || "You";
  }

  return {
    id: data.id,
    topicId: data.topic_id,
    authorId: data.author_id,
    authorName: resolvedName,
    kind: data.kind,
    body: data.body,
    mediaUrl: data.media_url,
    mediaType: data.media_type,
    replyToId: data.reply_to_id,
    aiAssisted: data.ai_assisted,
    createdAt: data.created_at,
    pinned: false,
  };
}

export async function togglePin(args: {
  topicId: string;
  messageId: string;
}): Promise<boolean> {
  if (!supabaseEnabled) {
    return demoTogglePin(args);
  }
  const supabase = createClient();
  // Probe whether a pin row already exists; toggle accordingly.
  const { data: existing } = await supabase
    .from("chat_pins")
    .select("message_id")
    .eq("message_id", args.messageId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("chat_pins")
      .delete()
      .eq("message_id", args.messageId);
    if (error) throw new Error(error.message);
    return false;
  }
  const ctx = await loadUserContext();
  // company_id is NOT NULL on chat_pins and not auto-populated by the
  // schema. We use ctx.companyId (guaranteed equal to the topic's
  // company_id by RLS) instead of re-fetching from chat_topics. The
  // §1.7 audit caught the original missing-company_id bug; this refactor
  // also eliminates the redundant topic lookup.
  const { error } = await supabase.from("chat_pins").insert({
    topic_id: args.topicId,
    message_id: args.messageId,
    company_id: ctx.companyId,
    pinned_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  return true;
}

/**
 * §3.5 durability review — record the consequence of a closed topic.
 *
 * Setting close_durability for the first time (or changing it later)
 * fires `chat.topic_durability_reviewed` via the 0015 trigger, which
 * derives the appropriate consequence signal (resolution_held,
 * problem_recurrence, partial_resolution). "unknown" earns no signal
 * by design — it means "we haven't measured the consequence yet."
 *
 * No demo branch: durability review is a §3.5 measurement and only
 * makes sense against persisted topics. In demo mode the closed topic
 * lives in localStorage and we just update the local state.
 */
export type DurabilityReview = "held" | "reopened" | "partial" | "unknown";

export async function reviewDurability(args: {
  topicId: string;
  durability: DurabilityReview;
}): Promise<boolean> {
  if (!supabaseEnabled) {
    const state = readDemoState();
    const topic = state.topics.find((t) => t.id === args.topicId);
    if (!topic) return false;
    topic.closeDurability = args.durability;
    writeDemoState(state);
    return true;
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_topics")
    .update({ close_durability: args.durability })
    .eq("id", args.topicId);
  if (error) throw new Error(error.message);
  return true;
}

export async function closeTopic(args: {
  topicId: string;
  summary: string;
}): Promise<boolean> {
  if (!supabaseEnabled) {
    return demoCloseTopic(args);
  }
  const ctx = await loadUserContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_topics")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: ctx.userId,
      close_summary: args.summary,
    })
    .eq("id", args.topicId);
  if (error) throw new Error(error.message);
  return true;
}

export function demoCloseTopic(args: {
  topicId: string;
  summary: string;
}): boolean {
  const state = readDemoState();
  const topic = state.topics.find((t) => t.id === args.topicId);
  if (!topic) return false;
  topic.status = "closed";
  topic.closedAt = new Date().toISOString();
  topic.closedBy = DEMO_USER_ID;
  topic.closeSummary = args.summary;
  const list = state.messages[args.topicId] ?? [];
  list.push({
    id: `system-close-${Date.now()}`,
    topicId: args.topicId,
    authorId: DEMO_USER_ID,
    authorName: DEMO_USER_NAME,
    kind: "system",
    body: `Topic closed: ${args.summary}`,
    mediaUrl: null,
    mediaType: null,
    replyToId: null,
    aiAssisted: false,
    createdAt: new Date().toISOString(),
    pinned: false,
  });
  state.messages[args.topicId] = list;
  writeDemoState(state);
  return true;
}
