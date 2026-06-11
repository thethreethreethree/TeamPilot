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
 * Read state stays client-side in localStorage for now. The sidebar
 * bell uses the same key for the unread dot. Cross-device sync waits
 * on a real read-receipts table when the §4 readout shows it matters.
 *
 * task.assigned is intentionally NOT a source yet — the legacy
 * `tasks.assignee` column is free text, not a user_id. A clean
 * `task.participant_added` event from a trigger on task_participants
 * is the right shape; that's a future migration, not a fake source
 * stapled on here.
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
  const kinds = ["mention.created", ...PHASE_2_TOPIC_KINDS];
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
    if (e.kind === "mention.created") {
      const p = e.payload ?? {};
      return (p as Record<string, unknown>).target_user_id === userId;
    }
    if ((PHASE_2_TOPIC_KINDS as readonly string[]).includes(e.kind)) {
      // Active participant + not the actor (you don't notify yourself).
      return e.actor !== userId && mySubjects.has(e.subject);
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
      chosenPath: (payload.chosen_path as string | undefined) ?? null,
    };
  });

  return NextResponse.json({ notifications });
}
