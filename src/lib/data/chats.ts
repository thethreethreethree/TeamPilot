import { createClient, supabaseEnabled } from "@/lib/supabase/client";

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
      "id, title, description, status, problem_id, created_by, created_at, closed_at, closed_by, close_summary, close_durability, tags"
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
  }));
  return {
    topics,
    mode: topics.length === 0 ? "live-empty" : "live-data",
  };
}

export async function fetchTopic(id: string): Promise<ChatTopic | null> {
  if (!supabaseEnabled) {
    return readDemoState().topics.find((t) => t.id === id) ?? null;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_topics")
    .select(
      "id, title, description, status, problem_id, created_by, created_at, closed_at, closed_by, close_summary, close_durability, tags"
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
  };
}

export async function fetchMessages(topicId: string): Promise<ChatMessage[]> {
  if (!supabaseEnabled) {
    return readDemoState().messages[topicId] ?? [];
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select(
      "id, topic_id, author_id, kind, body, media_url, media_type, reply_to_id, ai_assisted, created_at"
    )
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });
  if (!data) return [];
  // TODO Phase 1.1: resolve author_id → name via profiles join; pins lookup.
  return data.map((m) => ({
    id: m.id,
    topicId: m.topic_id,
    authorId: m.author_id,
    authorName: m.author_id ?? "Unknown",
    kind: m.kind,
    body: m.body,
    mediaUrl: m.media_url,
    mediaType: m.media_type,
    replyToId: m.reply_to_id,
    aiAssisted: m.ai_assisted,
    createdAt: m.created_at,
    pinned: false,
  }));
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
  return (data ?? []).map((p) => ({
    userId: p.user_id,
    name: p.user_id,
    role: p.role,
    joinedAt: p.joined_at,
    leftAt: p.left_at,
    messageCount: p.message_count,
    lastSeenAt: p.last_seen_at,
  }));
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
