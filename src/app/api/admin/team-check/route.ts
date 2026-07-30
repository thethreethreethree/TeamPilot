import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { isAdminRole } from "@/lib/supabase/auth-helpers";
import { isTaskClosed } from "@/lib/tasks/statusLabels";

/**
 * GET /api/admin/team-check
 *
 * Pillar 2 admin digest — surfaces (user, task) pairs that may need
 * a check-in, derived purely from observable engagement signals on
 * the §3.1 chain (last_engaged_at, engagement_count, joined_at).
 *
 * Constitutional frame:
 *   - §3.3 guide-don't-overtake: the System REPORTS counts; the admin
 *     decides whether and how to act. No "Marcus is failing" framing.
 *   - A7 constructive: every flagged row carries a suggested next
 *     step paired with the count, never a standalone warning.
 *   - A10 transparency: the same data the digest shows about user X
 *     is visible to user X on the task page (per-task view from
 *     /dashboard/operations/[id]). No shadow read.
 *   - A11 mirror frame: the suggested-next-step text is a question
 *     ("Want to check in?"), not a verdict ("They're failing.").
 *
 * Surfaces only:
 *   - Tasks that are NOT Completed (those are done; no point flagging)
 *   - Active participants only (left_at IS NULL)
 *   - Either (a) joined >= STALE_DAYS ago AND no engagement yet, or
 *           (b) last_engaged_at >= STALE_DAYS ago
 *
 * Admin-only at the API layer. RLS would let any company member see
 * the underlying tables, but the aggregated cross-user view is
 * specifically an admin tool — the constitutional act of leading the
 * room (§3.3). Non-admin callers get 403.
 */

const STALE_DAYS = 4;

type DigestRow = {
  userId: string;
  userName: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  taskPriority: string;
  participantRole: string;
  joinedAt: string;
  lastEngagedAt: string | null;
  engagementCount: number;
  daysStale: number;
  /** A7-framed suggested next step. Generated server-side so the
   *  admin sees a consistent voice across rows. Always a doorway,
   *  never a verdict. */
  suggestedNextStep: string;
};

function suggestNextStep(args: {
  userName: string;
  taskTitle: string;
  taskStatus: string;
  lastEngagedAt: string | null;
  daysStale: number;
}): string {
  const firstName = args.userName.split(" ")[0] || args.userName;
  // No engagement at all — they joined but haven't moved on it.
  if (args.lastEngagedAt === null) {
    return `Ask ${firstName} where the task should start — they joined ${args.daysStale} days ago and may be unsure how to enter.`;
  }
  // Task is in Blocked status; they may need cover.
  if (args.taskStatus === "Blocked") {
    return `Pair with ${firstName} on "${args.taskTitle}" — it's been Blocked for ${args.daysStale}+ days; one conversation may unblock it.`;
  }
  // Long staleness — meaningful pause.
  if (args.daysStale >= 8) {
    return `Check in with ${firstName} on "${args.taskTitle}". ${args.daysStale} days is enough that the next move is either fresh momentum or a clean handoff.`;
  }
  // Short staleness — light touch.
  return `Worth a check-in with ${firstName} on "${args.taskTitle}"? Last meaningful action was ${args.daysStale} days ago.`;
}

export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json({ rows: [] });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Admin gate — only CEO / COO / admin (company-wide) can see the
  // aggregated team-check digest. Per-task self-view is unaffected.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || !isAdminRole(profile.role)) {
    return NextResponse.json(
      { error: "Team-check is an admin surface (CEO / COO / admin)." },
      { status: 403 }
    );
  }

  const cutoffIso = new Date(
    Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Single query with embedded task + profile via PostgREST joins.
  // task_participants → tasks fk lets us select the task's title +
  // status in the same round trip; profiles is a separate batch
  // because the user_id → profiles relationship isn't auto-detected
  // (same constraint as the chat data layer).
  const { data: rows, error } = await supabase
    .from("task_participants")
    .select(
      "task_id, user_id, role, joined_at, left_at, last_engaged_at, engagement_count, tasks!inner(id, title, status, priority, deleted_at)"
    )
    .is("left_at", null);
  if (error) {
    console.error("[admin/team-check] query failed:", error);
    return NextResponse.json({ error: "Couldn't run the team check." }, { status: 500 });
  }

  type TaskShape = {
    id: string;
    title: string;
    status: string;
    priority: string;
    deleted_at: string | null;
  };
  type ParticipantRow = {
    task_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    left_at: string | null;
    last_engaged_at: string | null;
    engagement_count: number;
    // PostgREST returns the embedded resource as an array even for
    // a single-FK relationship; we unwrap on first access.
    tasks: TaskShape[] | TaskShape | null;
  };

  const unwrapTask = (t: ParticipantRow["tasks"]): TaskShape | null => {
    if (!t) return null;
    if (Array.isArray(t)) return t[0] ?? null;
    return t;
  };

  // Filter in JS — PostgREST OR + nested filters get awkward, and the
  // per-company task population is small enough (low hundreds at most
  // in the foreseeable future) that the cost is negligible.
  const filtered = ((rows ?? []) as unknown as ParticipantRow[])
    .map((r) => ({ ...r, _task: unwrapTask(r.tasks) }))
    .filter((r) => {
      const t = r._task;
      if (!t || t.deleted_at !== null) return false;
      // Exclude ALL terminal statuses, not just Completed — a cancelled task is
      // deliberately ended and needs no engagement nudge (§A26 class fix, see
      // isTaskClosed). Surfacing one would hand the admin a false action item.
      if (isTaskClosed(t.status)) return false;
      const lastEngaged = r.last_engaged_at;
      const joined = r.joined_at;
      if (lastEngaged === null) {
        // No engagement yet → flag if joined more than STALE_DAYS ago.
        return joined < cutoffIso;
      }
      return lastEngaged < cutoffIso;
    });

  // Resolve display names in one batch.
  const userIds = Array.from(new Set(filtered.map((r) => r.user_id)));
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const orFilter = userIds.map((id) => `id.eq.${id}`).join(",");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .or(orFilter);
    for (const p of profiles ?? []) {
      if (p.full_name)
        nameById.set(p.id as string, p.full_name as string);
    }
  }

  const now = Date.now();
  const digest: DigestRow[] = filtered.map((r) => {
    const reference = r.last_engaged_at ?? r.joined_at;
    const daysStale = Math.floor(
      (now - new Date(reference).getTime()) / (1000 * 60 * 60 * 24)
    );
    const userName = nameById.get(r.user_id) ?? "Teammate";
    const t = r._task!;
    return {
      userId: r.user_id,
      userName,
      taskId: r.task_id,
      taskTitle: t.title,
      taskStatus: t.status,
      taskPriority: t.priority,
      participantRole: r.role,
      joinedAt: r.joined_at,
      lastEngagedAt: r.last_engaged_at,
      engagementCount: r.engagement_count,
      daysStale,
      suggestedNextStep: suggestNextStep({
        userName,
        taskTitle: t.title,
        taskStatus: t.status,
        lastEngagedAt: r.last_engaged_at,
        daysStale,
      }),
    };
  });

  // Surface the longest-stale rows first — admin attention should
  // anchor on the row with most accumulated silence.
  digest.sort((a, b) => b.daysStale - a.daysStale);

  return NextResponse.json({ rows: digest, staleDays: STALE_DAYS });
}
