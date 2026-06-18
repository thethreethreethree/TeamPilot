import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/notifications
 *
 * Returns the current user's notification feed. Sources are derived
 * directly from the §3.1 chain — there is no notifications table.
 * The chain is the source of truth; a side table would duplicate
 * state and drift.
 *
 * Phase 1 source (mentions):
 *   - mention.created events where payload.target_user_id == caller.
 *
 * Phase 2 sources (Decision Dialogue activity in your rooms):
 *   - decision.opened / decision.decided events whose subject is a
 *     chat_topic the caller is an ACTIVE participant of, and where
 *     the caller is NOT the actor. "You opened the dialogue" is not
 *     a notification — it's a thing you just did.
 *
 * Phase 2 task source (added 2026-06-12, migration 0023):
 *   - task.participant_added events where payload.added_user_id ==
 *     caller. Self-add is filtered at the trigger level so we don't
 *     have to re-check actor here, but we still defensively skip
 *     self rows in case a trigger predates the self-skip logic.
 *
 * Read state stays client-side in localStorage for now. The sidebar
 * bell uses the same key for the unread dot. Cross-device sync waits
 * on a real read-receipts table when the §4 readout shows it matters.
 */

type ChainEventRow = {
  id: string;
  kind: string;
  subject: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
};

const PHASE_2_TOPIC_KINDS = ["decision.opened", "decision.decided"] as const;
const TASK_PARTICIPANT_KIND = "task.participant_added";
/** Per migration 0050 — C.A.R.E notification kinds. Targeting logic
 *  per-kind is in the filter pass below. */
const CARE_KINDS = [
  "care.conversation.message_added",
  "care.conversation.assigned",
  "care.conversation.guidance_requested",
  "care.conversation.durability_due",
] as const;
type CareKind = (typeof CARE_KINDS)[number];

export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json({ notifications: [] });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = auth.user.id;

  // Resolve the caller's C.A.R.E role flags once. Used to target
  // care.* events: support agents see message_added / assigned /
  // durability_due for their own conversations; admins additionally
  // see guidance_requested for any conversation in the company.
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", userId)
    .maybeSingle();
  const isSupportAgent =
    Boolean(myProfile?.is_support_agent) ||
    myProfile?.role === "CEO" ||
    myProfile?.role === "COO" ||
    myProfile?.role === "admin";
  const isCompanyAdmin =
    myProfile?.role === "CEO" ||
    myProfile?.role === "COO" ||
    myProfile?.role === "admin";

  // Topics the user is an ACTIVE participant of. We need this to
  // gate decision.* events to rooms the user is actually in. Doing
  // it as one round trip means the per-event filter below is a Set
  // lookup, not a per-event DB hit.
  const { data: myTopicsRaw } = await supabase
    .from("chat_participants")
    .select("topic_id")
    .eq("user_id", userId)
    .is("left_at", null);
  const myTopicIds = new Set(
    (myTopicsRaw ?? []).map((r) => r.topic_id as string)
  );
  const mySubjects = new Set(
    Array.from(myTopicIds).map((id) => `chat_topic:${id}`)
  );

  // Pull the relevant event kinds in one query. RLS scopes to the
  // user's company; we filter further in JS.
  const kinds = [
    "mention.created",
    ...PHASE_2_TOPIC_KINDS,
    TASK_PARTICIPANT_KIND,
    ...CARE_KINDS,
  ];
  const { data: events, error } = await supabase
    .from("events")
    .select("id, kind, subject, actor, payload, occurred_at")
    .in("kind", kinds)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (events ?? []) as ChainEventRow[];

  // Filter to events that actually belong to THIS user.
  const mine = rows.filter((e) => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (e.kind === "mention.created") {
      return p.target_user_id === userId;
    }
    if ((PHASE_2_TOPIC_KINDS as readonly string[]).includes(e.kind)) {
      // Active participant + not the actor (you don't notify yourself).
      return e.actor !== userId && mySubjects.has(e.subject);
    }
    if (e.kind === TASK_PARTICIPANT_KIND) {
      // I was the added user, AND the actor wasn't me. Trigger-level
      // self-skip should already enforce the second clause, but we
      // check defensively in case an older trigger emitted.
      return p.added_user_id === userId && e.actor !== userId;
    }
    // C.A.R.E targeting. Per migration 0050 emit triggers, each
    // care.* event payload carries the relevant agent id; we filter
    // per-user here without an extra DB lookup.
    if ((CARE_KINDS as readonly string[]).includes(e.kind)) {
      if (!isSupportAgent) return false;
      const kind = e.kind as CareKind;
      if (kind === "care.conversation.message_added") {
        // Notify the assigned agent only. Unassigned conversations
        // surface in the agent inbox already; we don't fan out to
        // every agent on every customer reply.
        const assigned = p.assigned_agent_id as string | null | undefined;
        return assigned === userId;
      }
      if (kind === "care.conversation.assigned") {
        // Notify the NEW assignee, only when it's not me reassigning
        // to myself.
        return p.new_agent_id === userId && e.actor !== userId;
      }
      if (kind === "care.conversation.guidance_requested") {
        // The "Need guidance" path the founder named explicitly.
        // Notifies all company admins (CEO / COO / admin), excluding
        // the requesting agent (they already know they asked).
        return isCompanyAdmin && p.requested_by_agent_id !== userId;
      }
      if (kind === "care.conversation.durability_due") {
        // Notify the agent who captured the resolution. If no
        // captured_by is recorded, fall through to assigned agent.
        const captured = p.captured_by_agent_id as string | null | undefined;
        return captured ? captured === userId : false;
      }
      return false;
    }
    return false;
  });

  // Resolve actor display names in one batch.
  const actorIds = Array.from(
    new Set(mine.map((e) => e.actor).filter((a): a is string => !!a))
  );
  const nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const orFilter = actorIds.map((id) => `id.eq.${id}`).join(",");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .or(orFilter);
    for (const p of profiles ?? []) {
      if (p.full_name) nameById.set(p.id as string, p.full_name as string);
    }
  }

  // For decision.* events the subject is `chat_topic:<id>` — pull the
  // topic title in one batch so the inbox row reads naturally instead
  // of showing a raw UUID.
  const topicIdsToResolve = Array.from(
    new Set(
      mine
        .filter((e) =>
          (PHASE_2_TOPIC_KINDS as readonly string[]).includes(e.kind)
        )
        .map((e) => e.subject.replace(/^chat_topic:/, ""))
    )
  );
  const topicTitleById = new Map<string, string>();
  if (topicIdsToResolve.length > 0) {
    const { data: topics } = await supabase
      .from("chat_topics")
      .select("id, title")
      .in("id", topicIdsToResolve);
    for (const t of topics ?? []) {
      topicTitleById.set(t.id as string, t.title as string);
    }
  }

  const notifications = mine.map((e) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const actorName = e.actor
      ? (nameById.get(e.actor) ?? "Someone")
      : "System";
    if (e.kind === "mention.created") {
      return {
        id: e.id,
        kind: e.kind,
        subject: e.subject,
        actorId: e.actor,
        actorName,
        occurredAt: e.occurred_at,
        sourceKind: payload.source_kind ?? null,
        sourceId: payload.source_id ?? null,
        excerpt: payload.excerpt ?? null,
        topicTitle: null,
        taskTitle: null,
        role: null,
        chosenPath: null,
      };
    }
    if (e.kind === TASK_PARTICIPANT_KIND) {
      const taskId = (payload.task_id as string | undefined) ?? null;
      return {
        id: e.id,
        kind: e.kind,
        subject: e.subject,
        actorId: e.actor,
        actorName,
        occurredAt: e.occurred_at,
        sourceKind: "task",
        sourceId: taskId,
        excerpt: null,
        topicTitle: null,
        taskTitle: (payload.task_title as string | undefined) ?? null,
        role: (payload.role as string | undefined) ?? null,
        chosenPath: null,
      };
    }
    if ((CARE_KINDS as readonly string[]).includes(e.kind)) {
      const convId =
        (payload.conversation_id as string | undefined) ??
        e.subject.replace(/^support_conversation:/, "");
      return {
        id: e.id,
        kind: e.kind,
        subject: e.subject,
        actorId: e.actor,
        actorName,
        occurredAt: e.occurred_at,
        sourceKind: "care_conversation",
        sourceId: convId,
        excerpt: (payload.preview as string | null) ?? null,
        topicTitle: (payload.subject as string | null) ?? null,
        taskTitle: null,
        role: (payload.priority as string | null) ?? null,
        chosenPath: null,
      };
    }
    // Decision events.
    const topicId = e.subject.replace(/^chat_topic:/, "");
    return {
      id: e.id,
      kind: e.kind,
      subject: e.subject,
      actorId: e.actor,
      actorName,
      occurredAt: e.occurred_at,
      sourceKind: "chat_topic",
      sourceId: topicId,
      excerpt: null,
      topicTitle: topicTitleById.get(topicId) ?? null,
      taskTitle: null,
      role: null,
      chosenPath: (payload.chosen_path as string | undefined) ?? null,
    };
  });

  return NextResponse.json({ notifications });
}
