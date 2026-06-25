import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchMessages } from "@/lib/data/chats";
import { fetchAgentConversation } from "@/lib/data/care";
import { debriefCoachV5 } from "@/lib/claude";
import { loadCoachMemory, renderMemoryForPrompt } from "./memory";
import {
  buildDebriefSystemPrompt,
  buildDebriefUserMessage,
} from "./debriefPrompt";
import type {
  CoachDebrief,
  CoachDebriefMessage,
  CoachDebriefSurface,
  EncouragementGrade,
} from "./types";

/**
 * Coach v5.0 — End-of-Conversation Debrief Engine
 *
 * One engine, both surfaces (Team Chat topic close + C.A.R.E resolve).
 * Reads the user's OWN authored messages in the conversation, pairs
 * each with its recorded post-send grade, loads the user's cross-
 * conversation pattern memory, and asks the Coach LLM to write the
 * two-part debrief (learned / workOn / closing).
 *
 * Design choices grounded in the constitution:
 *   - We read the ACTUAL messages, not just event aggregates, so the
 *     debrief can cite real moves (§3.6 — visible, specific learning).
 *   - Grades are the §3.5 consequence anchor for "workOn"; but they
 *     ENRICH rather than gate — if grades are missing (older messages,
 *     grader was down), the debrief degrades gracefully to null grades
 *     and the LLM leans on message content.
 *   - Honest empty state (§3.4): below MIN_AUTHORED_MESSAGES we do not
 *     even call the LLM — there isn't enough authored signal to teach
 *     from, and fabricating a lesson from one message is the exact
 *     dishonesty the product refuses.
 */

const EMPTY_DEBRIEF: CoachDebrief = {
  hasSignal: false,
  learned: [],
  workOn: [],
};

/** Below this many authored messages, skip the LLM and return the
 *  empty state. Mirrors memory.ts's sparse-data honesty gate. */
const MIN_AUTHORED_MESSAGES = 2;

const VALID_GRADES = new Set<EncouragementGrade>([
  "productive",
  "neutral",
  "needs_guidance",
  "withheld",
]);

/**
 * Generate the debrief for a just-ended conversation. Always resolves
 * to a CoachDebrief (never throws) — a debrief failure must never block
 * the close/resolve action that triggered it. On any error returns the
 * empty state, which the UI renders as "nothing to flag".
 */
export async function generateConversationDebrief(args: {
  surface: CoachDebriefSurface;
  conversationId: string;
  userId: string;
  companyId: string;
}): Promise<CoachDebrief> {
  try {
    const gathered =
      args.surface === "chat_topic"
        ? await gatherChatInputs(args.conversationId, args.userId)
        : await gatherSupportInputs(args.conversationId, args.userId);

    if (!gathered || gathered.messages.length < MIN_AUTHORED_MESSAGES) {
      return EMPTY_DEBRIEF;
    }

    // Cross-conversation memory uses the authenticated user's context
    // (the user generating this debrief is the conversation's author),
    // so loadCoachMemory() with no args reads the correct baseline.
    const memory = await loadCoachMemory();
    const memoryBlock = renderMemoryForPrompt(memory);

    const systemPrompt = buildDebriefSystemPrompt({ surface: args.surface });
    const userMessage = buildDebriefUserMessage({
      conversationTitle: gathered.title,
      messages: gathered.messages,
      memoryBlock,
    });

    const r = await debriefCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return EMPTY_DEBRIEF;

    const parsed = parseDebrief(r.text);
    return parsed ?? EMPTY_DEBRIEF;
  } catch {
    return EMPTY_DEBRIEF;
  }
}

type GatheredInputs = {
  title?: string;
  messages: CoachDebriefMessage[];
};

/**
 * Team Chat: the user's own messages in the topic, paired with grades
 * pulled from the coach.message_graded chain events (matched by
 * message_id). Missing grades → null.
 */
async function gatherChatInputs(
  topicId: string,
  userId: string
): Promise<GatheredInputs | null> {
  const all = await fetchMessages(topicId);
  const mine = all.filter(
    (m) => m.authorId === userId && m.kind === "message" && m.body
  );
  if (mine.length === 0) return null;

  const grades = await fetchChatGrades(userId, topicId);

  const messages: CoachDebriefMessage[] = mine.map((m) => ({
    body: m.body as string,
    grade: grades.get(m.id) ?? null,
    timestamp: m.createdAt,
  }));

  // Topic title for grounding — fetch lazily; absence is fine.
  let title: string | undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_topics")
      .select("title")
      .eq("id", topicId)
      .maybeSingle();
    title = (data?.title as string | undefined) ?? undefined;
  } catch {
    /* title is optional */
  }

  return { title, messages };
}

/**
 * Pull the user's per-message grades for a topic from the chain.
 * grade-sent stores subject="chat_topic:<id>" + payload.message_id +
 * payload.grade. Returns a map of message_id → grade. Best-effort.
 */
async function fetchChatGrades(
  userId: string,
  topicId: string
): Promise<Map<string, EncouragementGrade>> {
  const out = new Map<string, EncouragementGrade>();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("payload")
      .eq("actor", userId)
      .eq("kind", "coach.message_graded")
      .eq("subject", `chat_topic:${topicId}`)
      .limit(500);
    for (const row of data ?? []) {
      const p = (row.payload ?? {}) as Record<string, unknown>;
      const mid = typeof p.message_id === "string" ? p.message_id : null;
      const grade = p.grade;
      if (
        mid &&
        typeof grade === "string" &&
        VALID_GRADES.has(grade as EncouragementGrade)
      ) {
        out.set(mid, grade as EncouragementGrade);
      }
    }
  } catch {
    /* grades enrich but are not required */
  }
  return out;
}

/**
 * C.A.R.E: the agent's own messages in the conversation, with grades
 * read inline from support_messages.coach_grade (no events join needed).
 */
async function gatherSupportInputs(
  conversationId: string,
  userId: string
): Promise<GatheredInputs | null> {
  const result = await fetchAgentConversation(conversationId);
  if (!result) return null;

  const mine = result.messages.filter(
    (m) =>
      m.authorType === "agent" &&
      m.authorId === userId &&
      m.kind === "message" &&
      m.body
  );
  if (mine.length === 0) return null;

  const messages: CoachDebriefMessage[] = mine.map((m) => ({
    body: m.body as string,
    grade:
      m.coachGrade && VALID_GRADES.has(m.coachGrade) ? m.coachGrade : null,
    timestamp: m.createdAt,
  }));

  const title = result.conversation.subject ?? undefined;
  return { title, messages };
}

/**
 * Parse + validate the debrief LLM response. Tolerant of arrays that
 * arrive as a single string; rejects anything without a usable shape
 * (caller falls back to the empty state).
 */
function parseDebrief(text: string): CoachDebrief | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const learned = toStringArray(o.learned).slice(0, 3);
  const workOn = toStringArray(o.workOn).slice(0, 2);
  const closing =
    typeof o.closing === "string" && o.closing.trim().length > 0
      ? o.closing.trim()
      : undefined;

  // hasSignal defaults to whether there's any content to show.
  const hasSignal =
    o.hasSignal === false
      ? false
      : learned.length > 0 || workOn.length > 0;

  if (!hasSignal) return EMPTY_DEBRIEF;

  return { hasSignal: true, learned, workOn, closing };
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
  }
  if (typeof v === "string" && v.trim().length > 0) return [v.trim()];
  return [];
}
