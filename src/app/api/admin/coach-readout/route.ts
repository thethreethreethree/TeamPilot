import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

/**
 * GET /api/admin/coach-readout
 *
 * The §4 readout instrument for the Conversational Coach v1. Closes
 * the loop that asset A2 demands: we shipped the Coach with chain
 * events, and now we surface what those events say about whether the
 * feature actually changes downstream consequence.
 *
 * Two reads against the chain:
 *
 *   1. Topic outcomes split by `coach_enabled`:
 *      - Count, status, close_durability breakdown
 *      - Average time-to-close (hours)
 *      - Average message count per topic
 *      → answers "do coached topics resolve more durably?"
 *
 *   2. Per-heuristic acceptance from coach.suggestion_* events:
 *      - Offered / accepted / dismissed
 *      - Accept rate among acted-on suggestions
 *      → answers "is this heuristic mis-calibrated?" (per A4 —
 *        whether regex is sharp enough is a readout question, not
 *        a pre-decision)
 *
 * What this does NOT do (per A3 — anti-game-your-own-evaluation):
 *   - It does not compute a "Coach is working!" verdict. The reader
 *     interprets. Surfacing a green check at N=3 would be exactly
 *     the imitation-of-intelligence trap §5 warns against.
 *   - It does not weight accepted suggestions as proof of value.
 *     Acceptance is a leading indicator only; consequence is the
 *     comparison between coached and uncoached topic outcomes.
 */

type TopicStats = {
  total: number;
  closed: number;
  held: number;
  reopened: number;
  partial: number;
  unknown: number;
  avgCloseHours: number | null;
  avgMessages: number;
};

type HeuristicStats = {
  id: string;
  offered: number;
  accepted: number;
  dismissed: number;
  acceptRate: number | null;
};

function summarize(
  topics: Array<{
    id: string;
    status: string;
    close_durability: string | null;
    created_at: string;
    closed_at: string | null;
  }>,
  msgCountByTopic: Map<string, number>
): TopicStats {
  const total = topics.length;
  const closed = topics.filter((t) => t.status === "closed").length;
  const held = topics.filter((t) => t.close_durability === "held").length;
  const reopened = topics.filter((t) => t.close_durability === "reopened").length;
  const partial = topics.filter((t) => t.close_durability === "partial").length;
  // unknown = explicitly "unknown" OR closed without a durability mark
  // (we want to know how many closed topics never got reviewed at all)
  const unknown = topics.filter(
    (t) =>
      t.close_durability === "unknown" ||
      (t.status === "closed" && !t.close_durability)
  ).length;
  const closeTimesMs = topics
    .filter((t) => t.closed_at)
    .map(
      (t) =>
        new Date(t.closed_at as string).getTime() -
        new Date(t.created_at).getTime()
    )
    .filter((d) => d > 0);
  const avgCloseHours =
    closeTimesMs.length > 0
      ? closeTimesMs.reduce((a, b) => a + b, 0) / closeTimesMs.length / 3_600_000
      : null;
  const messageCounts = topics.map((t) => msgCountByTopic.get(t.id) ?? 0);
  const avgMessages =
    messageCounts.length > 0
      ? messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length
      : 0;
  return {
    total,
    closed,
    held,
    reopened,
    partial,
    unknown,
    avgCloseHours,
    avgMessages,
  };
}

export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Live mode required." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Complete onboarding first." },
      { status: 400 }
    );
  }

  // 1. Topics — RLS already scopes to the caller's company.
  const { data: topics, error: topicsErr } = await supabase
    .from("chat_topics")
    .select(
      "id, coach_enabled, status, close_durability, created_at, closed_at"
    );
  if (topicsErr) {
    return NextResponse.json(
      { error: topicsErr.message },
      { status: 500 }
    );
  }
  const all = topics ?? [];

  // 2. Message counts per topic — small enough we can do this as one
  // SELECT + bucket in TS rather than a separate query per topic.
  const { data: msgs, error: msgErr } = await supabase
    .from("chat_messages")
    .select("topic_id");
  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }
  const msgCountByTopic = new Map<string, number>();
  for (const m of msgs ?? []) {
    const t = m.topic_id as string;
    msgCountByTopic.set(t, (msgCountByTopic.get(t) ?? 0) + 1);
  }

  const coached = summarize(
    all.filter((t) => t.coach_enabled),
    msgCountByTopic
  );
  const uncoached = summarize(
    all.filter((t) => !t.coach_enabled),
    msgCountByTopic
  );

  // 3. Heuristic events. We could narrow further with a kind filter
  // but the coach event volume is small in v1.
  const { data: coachEvents, error: eventsErr } = await supabase
    .from("events")
    .select("kind, payload")
    .ilike("kind", "coach.suggestion_%");
  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message }, { status: 500 });
  }
  const heuristicAgg = new Map<
    string,
    { offered: number; accepted: number; dismissed: number }
  >();
  for (const e of coachEvents ?? []) {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const id = typeof payload.heuristic_id === "string" ? payload.heuristic_id : null;
    if (!id) continue;
    if (!heuristicAgg.has(id)) {
      heuristicAgg.set(id, { offered: 0, accepted: 0, dismissed: 0 });
    }
    const agg = heuristicAgg.get(id);
    if (!agg) continue;
    if (e.kind === "coach.suggestion_offered") agg.offered++;
    else if (e.kind === "coach.suggestion_accepted") agg.accepted++;
    else if (e.kind === "coach.suggestion_dismissed") agg.dismissed++;
  }
  const heuristics: HeuristicStats[] = Array.from(heuristicAgg.entries())
    .map(([id, counts]) => {
      const acted = counts.accepted + counts.dismissed;
      return {
        id,
        ...counts,
        acceptRate: acted > 0 ? counts.accepted / acted : null,
      };
    })
    .sort((a, b) => b.offered - a.offered);

  return NextResponse.json({
    coached,
    uncoached,
    heuristics,
    generatedAt: new Date().toISOString(),
  });
}
