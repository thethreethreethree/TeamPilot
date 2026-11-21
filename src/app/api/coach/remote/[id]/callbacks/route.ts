import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import type { Callback } from "@/lib/coach/remote/followThrough";

/**
 * POST /api/coach/remote/:id/callbacks { followThroughId, index } — turn one callback the customer asked for into a
 * task in the existing Tasks module (RSS Phase 6, Gong F26.4; docs/rss/docs/05-ROUTES.md).
 *
 * A PERSON confirms each one (§3.3): the AI found "call me Thursday", the rep (or their manager) clicks Add. The
 * task is assigned to the call's rep, due on the date said (if any), and its description quotes the line and links
 * the call at that moment. Created through the CALLER's client so the tasks table's own RLS and event trigger
 * (0006) apply exactly as for any task; the link row (callback_tasks, 0281) makes it once-only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-callbacks", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  let body: { followThroughId?: unknown; index?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const ftId = typeof body.followThroughId === "string" ? body.followThroughId : "";
  const index = Number(body.index);
  if (!ftId || !Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Which callback?" }, { status: 400 });

  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });

  const { data: ft } = await db
    .from("session_follow_through")
    .select("id, callbacks")
    .eq("id", ftId)
    .eq("session_id", id)
    .maybeSingle();
  const item = ((ft?.callbacks ?? []) as Callback[])[index];
  if (!ft || !item) return NextResponse.json({ error: "Callback not found." }, { status: 404 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("callback_tasks")
    .select("task_id")
    .eq("company_id", session.companyId)
    .eq("follow_through_id", ftId)
    .eq("item_index", index)
    .maybeSingle();
  if (existing) return NextResponse.json({ taskId: existing.task_id, already: true });

  const { data: rep } = await admin
    .from("profiles")
    .select("full_name")
    .eq("company_id", session.companyId)
    .eq("id", session.agentId)
    .maybeSingle();
  const at = item.atMs !== null ? `?t=${Math.floor(item.atMs / 1000)}` : "";
  const description =
    `From the call "${session.clientLabel ?? "Untitled"}" on ${session.startedAt.slice(0, 10)}:\n` +
    `“${item.quote}”\n\nListen: /dashboard/sales-coach/${id}${at}`;

  const { data: task, error } = await db
    .from("tasks")
    .insert({
      company_id: session.companyId,
      title: item.what.slice(0, 200),
      description,
      status: "To Do",
      priority: "Medium",
      due_date: item.due,
      assignee: (rep?.full_name as string | null) ?? null,
      assignee_user_id: session.agentId,
    })
    .select("id")
    .single();
  if (error || !task) {
    console.error(`[callbacks] task insert failed session=${id}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't create the task." }, { status: 500 });
  }
  const { error: linkErr } = await admin.from("callback_tasks").insert({
    company_id: session.companyId,
    follow_through_id: ftId,
    item_index: index,
    task_id: task.id,
    created_by: ctx.userId,
  });
  if (linkErr) console.error(`[callbacks] link insert failed session=${id}: ${linkErr.message}`);
  return NextResponse.json({ taskId: task.id, already: false });
}
