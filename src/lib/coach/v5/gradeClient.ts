"use client";

import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import type { EncouragementGrade, GradeRequest } from "./types";

/**
 * Coach v5.0 Encouragement System — client helpers.
 *
 * Fire-and-forget grade trigger + chain-query for displaying existing
 * grades on rendered messages.
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md §10.
 */

/**
 * Trigger the post-send grade for a message that just landed. Fire-
 * and-forget: errors are swallowed so a grader hiccup never affects
 * the user's experience of having sent the message.
 *
 * The result (if any) drives an optional onGraded callback so the UI
 * can update the indicator immediately without waiting for a chain
 * round-trip.
 */
export async function gradeSentMessage(args: {
  sentMessage: string;
  contextType: GradeRequest["contextType"];
  subject: string;
  messageId?: string;
  recentThread?: GradeRequest["recentThread"];
  parentMessage?: GradeRequest["parentMessage"];
  onGraded?: (grade: EncouragementGrade) => void;
}): Promise<void> {
  try {
    const res = await fetch("/api/coach/v5/grade-sent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentMessage: args.sentMessage,
        contextType: args.contextType,
        subject: args.subject,
        messageId: args.messageId,
        recentThread: args.recentThread,
        parentMessage: args.parentMessage,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      response?: { grade: EncouragementGrade };
    };
    if (data.response?.grade && args.onGraded) {
      args.onGraded(data.response.grade);
    }
  } catch {
    // Encouragement System is non-blocking. Silent failure is intentional.
  }
}

/**
 * Fetch existing grades for messages in a chat topic. Returns a map
 * from message_id → grade, so the chat page can hydrate the indicators
 * for previously-sent messages on load (the grader event was written
 * to the chain when the message was originally sent).
 *
 * Only messages with a known message_id payload are returned —
 * historical messages from before grading was wired won't appear.
 */
export async function fetchTopicMessageGrades(
  topicId: string
): Promise<Map<string, EncouragementGrade>> {
  const result = new Map<string, EncouragementGrade>();
  if (!supabaseEnabled) return result;
  const supabase = createClient();
  // Scope to the caller's OWN grades. A topic's message-grade indicators are the user's private
  // self-assessments (they grade their own sent messages), so `actor = self` is both the correct privacy
  // behavior (never surface a colleague's grade on their message) AND closes a LOW injection: without it,
  // the read returned every same-company `coach.message_graded` row for the topic, so a colleague who knew
  // a peer's topicId + messageId could write a row that surfaced a bogus indicator on the peer's message.
  // getSession() is LOCAL (no network round-trip). (The leader readout is separately unaffected — it
  // aggregates grade counts and ignores message_id/subject.)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return result;
  const { data, error } = await supabase
    .from("events")
    .select("payload, created_at")
    .eq("kind", "coach.message_graded")
    .eq("subject", `chat_topic:${topicId}`)
    .eq("actor", uid)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error || !data) return result;

  for (const row of data) {
    const payload = row.payload as
      | { message_id?: string; grade?: EncouragementGrade }
      | null;
    if (!payload?.message_id || !payload.grade) continue;
    // Last-write-wins by created_at ordering (newer rows overwrite).
    result.set(payload.message_id, payload.grade);
  }
  return result;
}
