import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { isAdminRole } from "@/lib/supabase/auth-helpers";
import { isTaskClosed } from "@/lib/tasks/statusLabels";

/**
 * POST /api/admin/team-check/nudge
 *
 * Admin-only check-in action paired with the Pillar 2 team-check
 * digest. Posts a task_message of kind='nudge' into the named task's
 * thread; the existing 0021 trigger emits a `task.nudge_sent` event
 * onto the §3.1 chain so the §4 readout can later measure whether
 * the nudge moved the work or not.
 *
 * Per A7, the body the admin posts is required to be non-trivial
 * (>= 12 chars) — an admin clicking "send" without changing the
 * suggested text is fine, since the suggested text is itself an
 * A7-framed doorway, but completely blank or hostile text gets
 * refused at the layer.
 *
 * The recipient is NOT named in the request payload — the message
 * goes into the task thread, where every active participant of the
 * task receives it via the task's own delivery (chain event +
 * notifications). This avoids a per-user "you got nudged" feed which
 * could read as targeting/surveillance (failing A10's spirit).
 */

const NudgeSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().min(12).max(2000),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "admin-team-check-nudge",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 400 }
    );
  }

  const body = await readBody(req, NudgeSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Admin gate — same shape as the GET route.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || !isAdminRole(profile.role)) {
    return NextResponse.json(
      { error: "Sending team-check nudges is an admin action." },
      { status: 403 }
    );
  }
  if (!profile.company_id) {
    return NextResponse.json(
      { error: "Onboarding incomplete." },
      { status: 400 }
    );
  }

  // Verify the task exists + belongs to the admin's company. The RLS
  // policy on task_messages would refuse a cross-company insert, but
  // explicit verification gives a 404 instead of a generic RLS error.
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, company_id, status, deleted_at")
    .eq("id", body.taskId)
    .maybeSingle();
  if (taskErr || !task || task.deleted_at !== null) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  if (task.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Cross-tenant action denied." }, { status: 403 });
  }
  // Block nudging on ANY terminal task, not just Completed. A nudge inserts a
  // task.nudge_sent event into the append-only §3.1 chain (0021 trigger below),
  // so nudging a deliberately-cancelled task both wastes the recipient's
  // attention AND writes a durable event for closed work (§A26 class fix).
  if (isTaskClosed(task.status)) {
    return NextResponse.json(
      { error: "Cannot nudge on a completed or cancelled task." },
      { status: 400 }
    );
  }

  // Insert the nudge. The 0021 trigger fires task.nudge_sent
  // automatically from the kind='nudge' message kind — no separate
  // event insert needed.
  const { data: msg, error: insertErr } = await supabase
    .from("task_messages")
    .insert({
      task_id: body.taskId,
      company_id: profile.company_id,
      author_id: auth.user.id,
      kind: "nudge",
      body: body.body,
      payload: { source: "admin_team_check" },
    })
    .select("id, task_id, author_id, kind, body, payload, created_at")
    .single();
  if (insertErr || !msg) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not post nudge." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: msg });
}
