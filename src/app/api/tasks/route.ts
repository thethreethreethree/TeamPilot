import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { allowedTaskTransitions } from "@/lib/tasks/statusLabels";

/**
 * Production task API. Live-mode only — the chain depends on real events being
 * emitted, which requires the DB triggers from migration 0006.
 *
 * GET    — list tasks for the current company (excluding soft-deleted)
 * POST   — create a task. Trigger emits `task.created` event.
 * PATCH  — update a task. Trigger emits per-field events (status, priority, etc.)
 * DELETE — soft delete (sets deleted_at). Trigger emits `task.deleted` event.
 */

async function getCompanyId() {
  if (!supabaseEnabled) return { error: "Live mode required (Supabase not configured)." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) return { error: "Complete onboarding first." };
  return { supabase, companyId: profile.company_id };
}

export async function GET() {
  const ctx = await getCompanyId();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("tasks")
    .select(
      "id, title, description, department, assignee, status, priority, ai_priority_score, impact_level, blocker_reason, due_date, created_at"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[tasks GET] failed to list tasks:", error);
    return NextResponse.json({ error: "Couldn't load tasks." }, { status: 500 });
  }
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await getCompanyId();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const body = await req.json();
  const required = ["title"];
  for (const f of required) {
    if (typeof body[f] !== "string" || !body[f].trim()) {
      return NextResponse.json(
        { error: `Field '${f}' is required.` },
        { status: 400 }
      );
    }
  }

  // Enforce the "a Blocked task must carry a reason" guarantee on CREATE. PATCH
  // already enforces it (route below), but POST did not — so a task could be
  // CREATED directly as Blocked with no reason, the primary bypass of the
  // guarantee the board advertises ("the API rejects the transition without
  // one"). The board's create modal already shows a blocker_reason field when
  // status=Blocked, so this needs no new UX; it just makes the guarantee true on
  // the create path too. (The detail-page TRANSITION to Blocked has no reason
  // field and still needs a UX decision — tracked separately in the queue.)
  if (
    body.status === "Blocked" &&
    (typeof body.blockerReason !== "string" || !body.blockerReason.trim())
  ) {
    return NextResponse.json(
      { error: "A blocker reason is required when creating a task as Blocked." },
      { status: 400 }
    );
  }

  // Spawn-engine linkage fields. The xor constraint in 0030 enforces
  // that linked_decision_id and linked_chat_topic_id can't both be
  // set, so we just pass through whatever the caller sent and let
  // the DB reject contradictions.
  const linkedDecisionId =
    typeof body.linkedDecisionId === "string" ? body.linkedDecisionId : null;
  const linkedChatTopicId =
    typeof body.linkedChatTopicId === "string" ? body.linkedChatTopicId : null;
  const linkedMessageIds = Array.isArray(body.linkedMessageIds)
    ? body.linkedMessageIds.filter((v: unknown) => typeof v === "string")
    : null;
  const spawnSteps = Array.isArray(body.spawnSteps)
    ? body.spawnSteps.filter((v: unknown) => typeof v === "string")
    : null;

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      company_id: ctx.companyId,
      title: body.title,
      description: body.description ?? null,
      department: body.department ?? null,
      assignee: body.assignee ?? null,
      status: body.status ?? "To Do",
      priority: body.priority ?? "Medium",
      ai_priority_score: body.aiPriorityScore ?? 0,
      impact_level: body.impactLevel ?? "Medium",
      blocker_reason: body.blockerReason ?? null,
      due_date: body.dueDate ?? null,
      linked_decision_id: linkedDecisionId,
      linked_chat_topic_id: linkedChatTopicId,
      linked_message_ids: linkedMessageIds,
      spawn_steps: spawnSteps,
    })
    .select("id")
    .single();

  // Seed working task_steps from the spawned steps (Pillar 2). The
  // spawn_steps jsonb is preserved on the task row as the IMMUTABLE
  // original plan; this seed creates the editable / checkable
  // working list. If no steps were spawned (direct-created task),
  // the checklist UI shows its A7-compliant empty state.
  if (data && spawnSteps && spawnSteps.length > 0) {
    const stepRows = spawnSteps.map((body: string, idx: number) => ({
      task_id: data.id,
      step_order: idx,
      body,
    }));
    const { error: stepsErr } = await ctx.supabase
      .from("task_steps")
      .insert(stepRows);
    if (stepsErr && process.env.NODE_ENV !== "production") {
      console.warn(
        "[tasks] task_steps seed failed; task created without working steps",
        stepsErr
      );
    }
  }

  if (error) {
    console.error("[tasks POST] failed to create task:", error);
    return NextResponse.json({ error: "Couldn't create the task." }, { status: 500 });
  }
  return NextResponse.json({ taskId: data.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCompanyId();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const body = await req.json();
  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const { id, ...patch } = body;

  // Whitelist mutable fields so a caller can't sneak in `company_id`, `deleted_at`,
  // `created_at`, etc. via the API.
  // Gate answer fields included so the persistent gate editor (S3)
  // can save inline. gate_last_edited_at is stamped automatically by
  // the trg_stamp_task_gate_edited trigger from 0032 — callers don't
  // need to set it. assignee_user_id surfaces here so the future
  // assignee-FK UI can land without a route change.
  const allowed = [
    "title",
    "description",
    "department",
    "assignee",
    "assignee_user_id",
    "status",
    "priority",
    "ai_priority_score",
    "impact_level",
    "blocker_reason",
    "due_date",
    "gate_what",
    "gate_resources",
    "gate_roles",
  ];
  const safePatch: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    const dbKey = camelToSnake(k);
    if (allowed.includes(dbKey)) safePatch[dbKey] = patch[k];
  }

  if (Object.keys(safePatch).length === 0) {
    return NextResponse.json(
      { error: "No mutable fields provided." },
      { status: 400 }
    );
  }

  // System-wide audit findings 7 + 8: server-side enforcement of
  // (a) blocker_reason required when status='Blocked'
  // (b) status transition graph — UI-only validation meant
  //     mobile / API consumers could drive invalid transitions.
  if (safePatch.status !== undefined || safePatch.blocker_reason !== undefined) {
    // Fetch current state to validate the transition. One extra
    // read per PATCH that touches status; minor cost for honest
    // state-machine integrity.
    const { data: current } = await ctx.supabase
      .from("tasks")
      .select("status, blocker_reason")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json(
        { error: "Task not found." },
        { status: 404 }
      );
    }
    const nextStatus =
      (safePatch.status as string | undefined) ??
      (current.status as string);
    const nextReason =
      "blocker_reason" in safePatch
        ? (safePatch.blocker_reason as string | null)
        : (current.blocker_reason as string | null);
    // (a) Blocker reason required when ending in Blocked.
    if (
      nextStatus === "Blocked" &&
      (!nextReason || nextReason.trim().length === 0)
    ) {
      return NextResponse.json(
        {
          error:
            "A blocker reason is required when marking a task Blocked.",
        },
        { status: 400 }
      );
    }
    // (b) Transition graph. Enforces the SAME graph the UI renders by importing
    // the one shared source of truth (allowedTaskTransitions) — previously this
    // was a drifted inline copy that keyed a phantom 'New' and omitted 'To Do' /
    // 'Needs Review', so it rejected legitimate API transitions (To Do → In
    // Progress) for the exact mobile/API consumers it was meant to guard.
    if (
      safePatch.status !== undefined &&
      safePatch.status !== current.status
    ) {
      const allowedNext = allowedTaskTransitions(current.status as string);
      if (!allowedNext.includes(nextStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${current.status} → ${nextStatus}. Allowed: ${
              allowedNext.length > 0 ? allowedNext.join(", ") : "(terminal — no transitions)"
            }.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const { error } = await ctx.supabase
    .from("tasks")
    .update(safePatch)
    .eq("id", id);

  if (error) {
    console.error("[tasks PATCH] failed to update task:", error);
    return NextResponse.json({ error: "Couldn't update the task." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getCompanyId();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await ctx.supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[tasks DELETE] failed to soft-delete task:", error);
    return NextResponse.json({ error: "Couldn't delete the task." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}
