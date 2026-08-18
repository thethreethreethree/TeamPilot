import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { mockTasks } from "@/lib/mock-data";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  assignee: string | null;
  /** FK on profiles (post-0032). Prefer over the legacy `assignee`
   *  text field for any new code that needs to identify the person. */
  assigneeUserId: string | null;
  status: string;
  priority: string;
  aiPriorityScore: number;
  impactLevel: string | null;
  blockerReason: string | null;
  dueDate: string | null;
  // ─── v1 gate (Pillar 1 — Understanding Gate) ──────────────────
  gateCleared: boolean;
  gateMode: "small" | "real" | null;
  gateWhat: string | null;
  gateResources: string | null;
  gateRoles: string | null;
  /** When the gate answers were last edited. The §A11 mirror
   *  surface reads this; UI shows "edited N times" as a count,
   *  never as a verdict. */
  gateLastEditedAt: string | null;
};

/** A working step on a task. Mutable text + completion. Spawned
 *  steps land here from the Task Spawn Engine (Sprint 1 of the
 *  spawn build); manually-added steps are also welcome. Completion
 *  events emit to the §3.1 chain via the 0032 trigger. */
export type TaskStep = {
  id: string;
  taskId: string;
  stepOrder: number;
  body: string;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
};

export type TaskParticipant = {
  taskId: string;
  userId: string;
  role: "owner" | "member" | "observer";
  joinedAt: string;
  leftAt: string | null;
  lastEngagedAt: string | null;
  engagementCount: number;
};

export type TaskMessage = {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  kind: "message" | "system" | "gate_cleared" | "status_changed" | "nudge";
  body: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

const fromMock = (): Task[] =>
  mockTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    department: t.department,
    assignee: t.assignee,
    status: t.status,
    priority: t.priority,
    aiPriorityScore: t.aiPriorityScore,
    impactLevel: t.impactLevel,
    blockerReason: t.blockerReason,
    dueDate: t.dueDate,
    // Mock fixtures predate the gate; show them as cleared so demo
    // mode doesn't make every task look stuck behind a gate.
    gateCleared: true,
    gateMode: "small" as const,
    gateWhat: t.description,
    gateResources: null,
    gateRoles: null,
    gateLastEditedAt: null,
    assigneeUserId: null,
  }));

/** Per TT.md A21 Command Center audit — distinct "live-error"
 *  so the UI surfaces "couldn't load" honestly instead of
 *  rendering a fake zero indistinguishable from "no tasks
 *  yet". §A11 honesty: 0 because the query failed ≠ 0 because
 *  nothing happened. */
export type FetchTasksMode =
  | "demo-fixtures"
  | "live-empty"
  | "live-data"
  | "live-error";

/**
 * Production fetcher. No silent mock fallback.
 *
 * - Demo mode (no Supabase keys): returns mock fixtures with mode='demo-fixtures'.
 *   The caller is responsible for displaying the demo banner.
 * - Live mode, no rows: returns empty array with mode='live-empty'. The caller
 *   shows an honest empty state ("create your first task"), NOT mock fixtures.
 *   This was the silent-fallback bug — demo data dressed as live data.
 * - Live mode, with rows: returns real data with mode='live-data'.
 */
export async function fetchTasks(): Promise<{ tasks: Task[]; mode: FetchTasksMode }> {
  if (!supabaseEnabled) {
    return { tasks: fromMock(), mode: "demo-fixtures" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, department, assignee, assignee_user_id, status, priority, ai_priority_score, impact_level, blocker_reason, due_date, gate_cleared, gate_mode, gate_what, gate_resources, gate_roles, gate_last_edited_at"
    )
    .is("deleted_at", null)
    .order("ai_priority_score", { ascending: false });

  if (error) {
    return { tasks: [], mode: "live-error" };
  }
  if (!data) {
    return { tasks: [], mode: "live-empty" };
  }

  const tasks: Task[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    department: row.department,
    assignee: row.assignee,
    assigneeUserId: row.assignee_user_id,
    status: row.status,
    priority: row.priority,
    aiPriorityScore: row.ai_priority_score,
    impactLevel: row.impact_level,
    blockerReason: row.blocker_reason,
    dueDate: row.due_date,
    gateCleared: row.gate_cleared ?? false,
    gateMode: row.gate_mode ?? null,
    gateWhat: row.gate_what,
    gateResources: row.gate_resources,
    gateRoles: row.gate_roles,
    gateLastEditedAt: row.gate_last_edited_at,
  }));

  return {
    tasks,
    mode: tasks.length === 0 ? "live-empty" : "live-data",
  };
}

/**
 * Fetch a single task by id. Used by the task detail page.
 */
export async function fetchTask(id: string): Promise<Task | null> {
  if (!supabaseEnabled) {
    return fromMock().find((t) => t.id === id) ?? null;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, department, assignee, assignee_user_id, status, priority, ai_priority_score, impact_level, blocker_reason, due_date, gate_cleared, gate_mode, gate_what, gate_resources, gate_roles, gate_last_edited_at"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  // Classify the error — a transient read failure must NOT look like a deleted/not-found task (error-as-no-data,
  // INV22 / the §3.4 honesty thesis). `null` means genuinely-not-found; a query error throws so the page shows an
  // honest error state instead of "task not found". Mirrors fetchTasks' live-error handling.
  if (error) throw new Error(`Failed to load the task: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    department: data.department,
    assignee: data.assignee,
    assigneeUserId: data.assignee_user_id,
    status: data.status,
    priority: data.priority,
    aiPriorityScore: data.ai_priority_score,
    impactLevel: data.impact_level,
    blockerReason: data.blocker_reason,
    dueDate: data.due_date,
    gateCleared: data.gate_cleared ?? false,
    gateMode: data.gate_mode ?? null,
    gateWhat: data.gate_what,
    gateResources: data.gate_resources,
    gateRoles: data.gate_roles,
    gateLastEditedAt: data.gate_last_edited_at,
  };
}

/**
 * Clear the Understanding Gate on a task — Pillar 1.
 * Inserts a `gate_cleared` system message into the thread so the
 * event lands on the §3.1 chain via the existing trigger.
 *
 * Modes:
 *   - small: only `what` is required (one-sentence task).
 *   - real:  what + resources + roles all required (structured task).
 *
 * The §4 readout will compare durability outcomes between the two
 * modes — that data answers whether the small-mode escape hatch
 * undermines the gate or rescues it (per A4).
 */
export async function clearTaskGate(args: {
  taskId: string;
  mode: "small" | "real";
  what: string;
  resources?: string | null;
  roles?: string | null;
}): Promise<void> {
  if (!supabaseEnabled) return;
  if (args.mode === "real" && (!args.resources || !args.roles)) {
    throw new Error(
      "Real-mode gate requires both Resources and Roles fields."
    );
  }
  if (!args.what.trim()) {
    throw new Error("The 'What are we accomplishing' field is required.");
  }
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Company missing");

  const { error: updateErr } = await supabase
    .from("tasks")
    .update({
      gate_cleared: true,
      gate_mode: args.mode,
      gate_what: args.what.trim(),
      gate_resources: args.resources?.trim() || null,
      gate_roles: args.roles?.trim() || null,
    })
    .eq("id", args.taskId);
  if (updateErr) throw new Error(updateErr.message);

  // System message → trigger emits task.gate_cleared event on §3.1 chain.
  await supabase.from("task_messages").insert({
    task_id: args.taskId,
    company_id: profile.company_id,
    author_id: auth.user.id,
    kind: "gate_cleared",
    body: `Understanding Gate cleared (${args.mode} mode)`,
    payload: {
      mode: args.mode,
      what: args.what.trim(),
      has_resources: !!args.resources?.trim(),
      has_roles: !!args.roles?.trim(),
    },
  });
}

/**
 * Fetch the message thread for a task. Messages are append-only at
 * the SQL layer per §3.1; this just reads them in chronological order.
 */
export async function fetchTaskMessages(
  taskId: string
): Promise<TaskMessage[]> {
  if (!supabaseEnabled) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_messages")
    .select("id, task_id, author_id, kind, body, payload, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  // A transient read failure must not silently render an empty thread (messages look deleted) — throw so the
  // page shows an honest error, not a false-empty (INV22 / §3.4).
  if (error) throw new Error(`Failed to load the task messages: ${error.message}`);
  if (!data) return [];

  const authorIds = Array.from(
    new Set(
      data
        .map((m) => m.author_id)
        .filter((id): id is string => typeof id === "string")
    )
  );
  const nameById = new Map<string, string>();
  if (authorIds.length > 0) {
    const orFilter = authorIds.map((id) => `id.eq.${id}`).join(",");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .or(orFilter);
    for (const p of profiles ?? []) {
      if (p.full_name) nameById.set(p.id, p.full_name);
    }
  }

  return data.map((m) => ({
    id: m.id,
    taskId: m.task_id,
    authorId: m.author_id,
    authorName: m.author_id
      ? (nameById.get(m.author_id) ?? "Unknown")
      : "System",
    kind: m.kind,
    body: m.body,
    payload: (m.payload ?? {}) as Record<string, unknown>,
    createdAt: m.created_at,
  }));
}

/**
 * Post a message into a task's thread. Also increments engagement on
 * the author's participant row (Pillar 2 — only *meaningful* actions
 * count toward last_engaged_at, never page views).
 */
export async function postTaskMessage(args: {
  taskId: string;
  body: string;
}): Promise<TaskMessage> {
  if (!supabaseEnabled) throw new Error("Live mode required");
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Company missing");

  const { data, error } = await supabase
    .from("task_messages")
    .insert({
      task_id: args.taskId,
      company_id: profile.company_id,
      author_id: auth.user.id,
      kind: "message",
      body: args.body,
      payload: {},
    })
    .select("id, task_id, author_id, kind, body, payload, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Insert failed");

  void recordEngagement(args.taskId);

  // Coach v2 (mirror frame, A11) — log per-heuristic observations on
  // the FINAL posted text so the next draft's mirror chip has fresh
  // counts to compare against.
  void import("@/lib/coach/observe").then(({ observePatterns }) =>
    observePatterns({
      subject: `task:${args.taskId}`,
      bodyText: args.body,
    })
  );

  return {
    id: data.id,
    taskId: data.task_id,
    authorId: data.author_id,
    authorName: profile.full_name ?? "You",
    kind: data.kind,
    body: data.body,
    payload: (data.payload ?? {}) as Record<string, unknown>,
    createdAt: data.created_at,
  };
}

/**
 * Change a task's status. Inserts a status_changed system message
 * (which fires the task.status_changed event via the trigger) and
 * records engagement.
 */
export async function changeTaskStatus(args: {
  taskId: string;
  fromStatus: string;
  toStatus: string;
}): Promise<void> {
  if (!supabaseEnabled) return;
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Company missing");

  const { error: updateErr } = await supabase
    .from("tasks")
    .update({ status: args.toStatus })
    .eq("id", args.taskId);
  if (updateErr) throw new Error(updateErr.message);

  await supabase.from("task_messages").insert({
    task_id: args.taskId,
    company_id: profile.company_id,
    author_id: auth.user.id,
    kind: "status_changed",
    body: `Status: ${args.fromStatus} → ${args.toStatus}`,
    payload: { from: args.fromStatus, to: args.toStatus },
  });
  void recordEngagement(args.taskId);
}

/**
 * Fetch participants on a task. Returns the engagement signals
 * needed for Pillar 2 (last_engaged_at, engagement_count).
 *
 * Per A10 (transparency): a participant can ALWAYS see their own
 * row in this data. There's no shadow read.
 */
export async function fetchTaskParticipants(
  taskId: string
): Promise<TaskParticipant[]> {
  if (!supabaseEnabled) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_participants")
    .select("task_id, user_id, role, joined_at, left_at, last_engaged_at, engagement_count")
    .eq("task_id", taskId);
  // Throw on a transient read failure — an empty participants list on error is error-as-no-data (INV22 / §3.4).
  if (error) throw new Error(`Failed to load the task participants: ${error.message}`);
  if (!data) return [];
  return data.map((p) => ({
    taskId: p.task_id,
    userId: p.user_id,
    role: p.role,
    joinedAt: p.joined_at,
    leftAt: p.left_at,
    lastEngagedAt: p.last_engaged_at,
    engagementCount: p.engagement_count ?? 0,
  }));
}

/**
 * Record a "meaningful action" on a task by the current user. The
 * Pillar-2 contract: engagement is only ever set when the user does
 * something OBSERVABLE on the task — posts a message, changes a
 * status, uploads. Never on page view. Per A7, anything we surface
 * about this data to the user must come with a constructive next
 * step, not a warning.
 *
 * §1.7 audit M4 fix (2026-06-12): previously a read-then-write
 * (SELECT engagement_count, then UPSERT with read+1). Two concurrent
 * engagement events both observed the same pre-value and each wrote
 * pre+1 — one increment lost on every collision. Now delegated to
 * record_task_engagement() (migration 0028), which performs a
 * single-statement INSERT ... ON CONFLICT DO UPDATE with the increment
 * happening inside the on-conflict path under the row lock. Atomic
 * by construction; concurrent calls serialize cleanly.
 */
export async function recordEngagement(taskId: string): Promise<void> {
  if (!supabaseEnabled) return;
  const supabase = createClient();
  await supabase.rpc("record_task_engagement", { p_task_id: taskId });
}


// ─── Task steps (Pillar 2: Accountability) ────────────────────────

/**
 * Fetch the working step list for a task. Ordered by step_order.
 * Steps are seeded from the Spawn Engine when a task is created via
 * /api/tasks/spawn; manually-added steps are appended at the end.
 */
export async function fetchTaskSteps(taskId: string): Promise<TaskStep[]> {
  if (!supabaseEnabled) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_steps")
    .select("id, task_id, step_order, body, completed_at, completed_by, created_at")
    .eq("task_id", taskId)
    .order("step_order", { ascending: true });
  // Throw on a transient read failure — an empty step list on error is error-as-no-data (INV22 / §3.4).
  if (error) throw new Error(`Failed to load the task steps: ${error.message}`);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    stepOrder: r.step_order,
    body: r.body,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    createdAt: r.created_at,
  }));
}

/**
 * Toggle a step's completion. The trigger in 0032 emits the
 * task.step_completed / task.step_reopened event to the §3.1 chain
 * automatically — we just flip the row.
 */
export async function toggleTaskStep(args: {
  stepId: string;
  completed: boolean;
}): Promise<void> {
  if (!supabaseEnabled) return;
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase
    .from("task_steps")
    .update({
      completed_at: args.completed ? new Date().toISOString() : null,
      completed_by: args.completed ? auth.user?.id ?? null : null,
    })
    .eq("id", args.stepId);
}

/**
 * Add a new step to the bottom of a task's step list. Returns the
 * new step's row so the caller can append optimistically.
 */
export async function addTaskStep(args: {
  taskId: string;
  body: string;
}): Promise<TaskStep | null> {
  if (!supabaseEnabled) return null;
  const supabase = createClient();
  // Concurrent adds (two participants, or a double-submit) both read the same max step_order and insert the same
  // next value; the deferred UNIQUE (task_id, step_order) then aborts one at COMMIT with 23505 — which the old
  // `if (error) return null` swallowed, so the step vanished with no error surfaced (audit 2026-08-19). Retry on
  // the collision: the loser re-reads the now-committed max and takes the next slot. Any OTHER error gives up.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: existing } = await supabase
      .from("task_steps")
      .select("step_order")
      .eq("task_id", args.taskId)
      .order("step_order", { ascending: false })
      .limit(1);
    const nextOrder = ((existing?.[0]?.step_order as number) ?? -1) + 1;
    const { data, error } = await supabase
      .from("task_steps")
      .insert({
        task_id: args.taskId,
        step_order: nextOrder,
        body: args.body,
      })
      .select("id, task_id, step_order, body, completed_at, completed_by, created_at")
      .single();
    if (!error && data) {
      return {
        id: data.id,
        taskId: data.task_id,
        stepOrder: data.step_order,
        body: data.body,
        completedAt: data.completed_at,
        completedBy: data.completed_by,
        createdAt: data.created_at,
      };
    }
    if ((error as { code?: string } | null)?.code !== "23505") return null; // not an order collision — give up
  }
  return null; // exhausted retries under extreme contention — caller surfaces the failure honestly
}

/**
 * Edit a step's body text. Body edits do NOT emit a chain event —
 * only completion toggles do (per the 0032 trigger). Editable
 * by any participant of the task per RLS.
 */
export async function editTaskStepBody(args: {
  stepId: string;
  body: string;
}): Promise<void> {
  if (!supabaseEnabled) return;
  const supabase = createClient();
  await supabase
    .from("task_steps")
    .update({ body: args.body })
    .eq("id", args.stepId);
}

/**
 * Delete a step. Tightening: only allowed when the step is NOT
 * completed (we don't lose completion history that way; the row
 * stays as the on-record evidence). Returns true on success.
 */
export async function deleteTaskStep(stepId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("task_steps")
    .delete()
    .eq("id", stepId)
    .is("completed_at", null);
  return !error;
}
