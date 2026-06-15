import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { resolveCyclePhase } from "@/lib/cycle/phase";

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

type SurfaceStats = {
  /** Prefix of the event subject — e.g. "chat_topic", "task",
   *  "feedback", "smoke_test_result", "decision". Drives the
   *  bucketing in the §4 readout. */
  surface: string;
  offered: number;
  accepted: number;
  dismissed: number;
  acceptRate: number | null;
  /** Top heuristic by offered count on this surface (for at-a-glance
   *  in the per-surface row; full per-heuristic table is below). */
  topHeuristic: string | null;
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
  // but the coach event volume is small in v1. Pulling subject too so
  // we can bucket by surface (prefix before `:`).
  const { data: coachEvents, error: eventsErr } = await supabase
    .from("events")
    .select("kind, payload, subject")
    .ilike("kind", "coach.suggestion_%");
  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message }, { status: 500 });
  }
  const heuristicAgg = new Map<
    string,
    { offered: number; accepted: number; dismissed: number }
  >();
  // Per-surface bucket: subject prefix (before ':') → counts +
  // per-heuristic tally so we can name the top heuristic for that
  // surface at-a-glance.
  const surfaceAgg = new Map<
    string,
    {
      offered: number;
      accepted: number;
      dismissed: number;
      heuristics: Map<string, number>;
    }
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

    // Surface bucketing — split subject on the first `:`.
    const subject = typeof e.subject === "string" ? e.subject : "";
    const surface = subject.split(":")[0] || "unknown";
    if (!surfaceAgg.has(surface)) {
      surfaceAgg.set(surface, {
        offered: 0,
        accepted: 0,
        dismissed: 0,
        heuristics: new Map(),
      });
    }
    const s = surfaceAgg.get(surface);
    if (!s) continue;
    if (e.kind === "coach.suggestion_offered") s.offered++;
    else if (e.kind === "coach.suggestion_accepted") s.accepted++;
    else if (e.kind === "coach.suggestion_dismissed") s.dismissed++;
    if (e.kind === "coach.suggestion_offered") {
      s.heuristics.set(id, (s.heuristics.get(id) ?? 0) + 1);
    }
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

  const surfaces: SurfaceStats[] = Array.from(surfaceAgg.entries())
    .map(([surface, counts]) => {
      const acted = counts.accepted + counts.dismissed;
      const topHeuristic =
        Array.from(counts.heuristics.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0]?.[0] ?? null;
      return {
        surface,
        offered: counts.offered,
        accepted: counts.accepted,
        dismissed: counts.dismissed,
        acceptRate: acted > 0 ? counts.accepted / acted : null,
        topHeuristic,
      };
    })
    .sort((a, b) => b.offered - a.offered);

  // ─── §3.4 cycle context ──────────────────────────────────────
  // The cycle phase frames every metric below. Outcomes during
  // 'control' belong to a Coach-OFF baseline; outcomes during
  // 'intervention' or 'ongoing' are post-Coach. The readout
  // surfaces this so the reader interprets the comparison
  // honestly (§3.5).
  const { data: company } = await supabase
    .from("companies")
    .select(
      "cycle_started_at, cycle_control_skipped_at, cycle_control_skip_reason"
    )
    .eq("id", companyId)
    .maybeSingle();
  const cycleDetails =
    company?.cycle_started_at
      ? resolveCyclePhase({
          cycleStartedAt: company.cycle_started_at,
          cycleControlSkippedAt: company.cycle_control_skipped_at,
        })
      : null;
  const cycleBlock = cycleDetails && {
    phase: cycleDetails.phase,
    daysIntoCycle: cycleDetails.daysIntoCycle,
    daysRemainingInPhase: cycleDetails.daysRemainingInPhase,
    skippedControl: cycleDetails.skippedControl,
    skippedAt: cycleDetails.skippedAt,
    skipReason: company?.cycle_control_skip_reason ?? null,
    cycleStartedAt: company?.cycle_started_at ?? null,
  };

  // ─── Task Spawn lineage ─────────────────────────────────────
  // Closes §1.6 on the measurement side: are tasks spawned from
  // structured sources (decisions, chats) actually producing
  // better outcomes than directly-created tasks? This is the
  // mechanism check — better diagnosis → better action.
  const { data: tasksRows } = await supabase
    .from("tasks")
    .select(
      "id, status, linked_decision_id, linked_chat_topic_id, created_at, updated_at"
    )
    .is("deleted_at", null);
  const tasksAll = tasksRows ?? [];
  function summarizeTasks(
    rows: typeof tasksAll
  ): { total: number; completed: number; completionRate: number | null } {
    const total = rows.length;
    // Status name fix (2026-06-15): the readout previously checked
    // for "Done" but the UI status enum is "Completed" (see
    // STATUS_TRANSITIONS in operations/[id]/page.tsx). With the
    // wrong literal, the spawn-lineage completion rate read zero
    // regardless of actual data. §3.5 honest measurement requires
    // the literal to match the chain.
    const completed = rows.filter((t) => t.status === "Completed").length;
    return {
      total,
      completed,
      completionRate: total > 0 ? completed / total : null,
    };
  }
  const tasksSpawn = {
    fromDecision: summarizeTasks(
      tasksAll.filter((t) => t.linked_decision_id)
    ),
    fromChat: summarizeTasks(
      tasksAll.filter((t) => t.linked_chat_topic_id)
    ),
    direct: summarizeTasks(
      tasksAll.filter((t) => !t.linked_decision_id && !t.linked_chat_topic_id)
    ),
    total: tasksAll.length,
  };

  // Step completion velocity — reads the new task.step_completed
  // chain events from migration 0032. Answers the §1.6-on-tasks
  // question: are spawned-from-structured-source tasks executing
  // their steps at a different rate than direct-created tasks?
  // Honest measurement requires the new schema; falls back to zero
  // until 0032's chain events accumulate.
  const stepWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: stepEvents } = await supabase
    .from("events")
    .select("kind, subject, created_at")
    .in("kind", ["task.step_completed", "task.step_reopened"])
    .gte("created_at", stepWindowStart)
    .limit(2000);
  let stepsCompleted30d = 0;
  let stepsReopened30d = 0;
  for (const e of stepEvents ?? []) {
    if (e.kind === "task.step_completed") stepsCompleted30d += 1;
    else if (e.kind === "task.step_reopened") stepsReopened30d += 1;
  }
  const tasksSteps30d = {
    completed: stepsCompleted30d,
    reopened: stepsReopened30d,
    /** Net completion = completed - reopened. The §A11 framing: a
     *  step that re-opens is data, not a verdict; sometimes the
     *  diagnosis was wrong and the re-open is correct. The readout
     *  shows both counts side-by-side so the reader interprets. */
    net: stepsCompleted30d - stepsReopened30d,
  };

  // ─── Coach v5 baseline & analyze patterns ───────────────────
  // The Encouragement System grade mix is the user's communication
  // baseline. §3.5 differentiated metric — "better" is downstream
  // consequence (productive grades + held resolutions), NEVER
  // "the AI's suggestion was adopted."
  const last30 = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: gradeEvents } = await supabase
    .from("events")
    .select("payload, created_at")
    .eq("kind", "coach.message_graded")
    .gte("created_at", last30)
    .limit(2000);
  const gradeMix = { productive: 0, neutral: 0, needsGuidance: 0 };
  let gradeTotal = 0;
  for (const e of gradeEvents ?? []) {
    const grade = (e.payload ?? ({} as Record<string, unknown>)).grade;
    if (grade === "productive") {
      gradeMix.productive++;
      gradeTotal++;
    } else if (grade === "neutral") {
      gradeMix.neutral++;
      gradeTotal++;
    } else if (grade === "needs_guidance") {
      gradeMix.needsGuidance++;
      gradeTotal++;
    }
  }
  const grades = {
    ...gradeMix,
    total: gradeTotal,
  };

  // Analyze patterns — top principles cited across the company in
  // the last 30 days. Surfaces what the Coach has been TEACHING,
  // not whether the team is accepting.
  const { data: analyzeEvents } = await supabase
    .from("events")
    .select("payload, created_at")
    .eq("kind", "coach.analyze_returned")
    .gte("created_at", last30)
    .limit(2000);
  const principleAgg = new Map<
    string,
    {
      principle: string;
      book: string | null;
      count: number;
      needsImprovementCount: number;
    }
  >();
  let analyzeTotal = 0;
  for (const e of analyzeEvents ?? []) {
    analyzeTotal++;
    const p = (e.payload ?? ({} as Record<string, unknown>));
    const principle = typeof p.principle === "string" ? p.principle : null;
    if (!principle) continue;
    const book = typeof p.book === "string" ? p.book : null;
    const needs = p.needs_improvement === true;
    const existing = principleAgg.get(principle);
    if (existing) {
      existing.count += 1;
      if (needs) existing.needsImprovementCount += 1;
    } else {
      principleAgg.set(principle, {
        principle,
        book,
        count: 1,
        needsImprovementCount: needs ? 1 : 0,
      });
    }
  }
  const topPrinciples = Array.from(principleAgg.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const analyzeBlock = {
    total: analyzeTotal,
    topPrinciples,
  };

  return NextResponse.json({
    coached,
    uncoached,
    heuristics,
    surfaces,
    cycle: cycleBlock,
    tasksSpawn,
    tasksSteps30d,
    grades,
    analyze: analyzeBlock,
    generatedAt: new Date().toISOString(),
  });
}
