import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { isTaskClosed } from "@/lib/tasks/statusLabels";
import { eventValue } from "@/lib/coach/remote/macroMode";

/**
 * /api/coach/remote/prospects/:pid — one prospect in the Remote Sales pipeline (Macro Mode, 0303).
 *   GET  → { prospect, history, calls, todos }
 *   POST { action: "set", kind, value }   — a new fact (stage/amount/next call/name/organization) as an EVENT (§3.1)
 *        { action: "link", sessionId }    — this call belongs to this prospect (last call date is derived from links)
 *        { action: "todo", title, due }   — a to-do, created as a Task assigned to the prospect's rep
 * All reads and writes go through the caller's client: a prospect the caller cannot see is a 404 for reads and a
 * refused insert for writes (0303's policies), never a confirmation that it exists.
 */
const Set_ = z.object({
  action: z.literal("set"),
  kind: z.enum(["name", "organization", "stage", "amount", "next_call"]),
  value: z.union([z.string().max(120), z.number().min(0).max(1e10), z.null(), z.object({ status: z.enum(["open", "won", "lost"]), label: z.string().max(60).optional() })]),
});
const Link = z.object({ action: z.literal("link"), sessionId: z.string().uuid() });
const Todo = z.object({ action: z.literal("todo"), title: z.string().trim().min(1).max(200), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });
const Body = z.discriminatedUnion("action", [Set_, Link, Todo]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-prospect-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { pid } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: p, error } = await db.from("remote_prospects_current").select("*").eq("id", pid).maybeSingle();
  if (error) {
    console.error(`[prospect] read failed id=${pid}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load this prospect." }, { status: 500 });
  }
  if (!p) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  const [ev, calls, links] = await Promise.all([
    db.from("remote_prospect_events").select("kind, value, actor_id, created_at").eq("prospect_id", pid).order("id", { ascending: false }).limit(100),
    db.from("remote_prospect_calls").select("session_id, created_at").eq("prospect_id", pid),
    db.from("remote_prospect_tasks").select("task_id").eq("prospect_id", pid),
  ]);
  if (ev.error || calls.error || links.error) return NextResponse.json({ error: "Couldn't load this prospect." }, { status: 500 });
  const sessionIds = ((calls.data ?? []) as Array<{ session_id: string }>).map((c) => c.session_id);
  const taskIds = ((links.data ?? []) as Array<{ task_id: string }>).map((l) => l.task_id);
  const [sess, tasks] = await Promise.all([
    sessionIds.length
      ? db.from("coaching_sessions").select("id, client_label, context, started_at, outcome").in("id", sessionIds).order("started_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    taskIds.length ? db.from("tasks").select("id, title, status, due_date").in("id", taskIds) : Promise.resolve({ data: [], error: null }),
  ]);
  return NextResponse.json({
    prospect: p,
    history: ev.data ?? [],
    calls: ((sess.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: String(s.id), label: s.client_label ?? null, context: s.context, startedAt: s.started_at, outcome: s.outcome ?? null,
    })),
    todos: ((tasks.data ?? []) as Array<{ id: string; title: string; status: string | null; due_date: string | null }>)
      .map((t) => ({ id: String(t.id), title: t.title, due: t.due_date, status: t.status ?? "To Do", done: isTaskClosed(t.status) }))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999")),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-prospect-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { pid } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: p } = await db.from("remote_prospects").select("id, rep_id, company_id").eq("id", pid).maybeSingle();
  if (!p) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });

  if (body.action === "set") {
    const value = eventValue(body.kind, body.value);
    if (!value) return NextResponse.json({ error: "That value doesn't fit this field." }, { status: 400 });
    const { error } = await db.from("remote_prospect_events").insert({ prospect_id: pid, company_id: p.company_id, kind: body.kind, value, actor_id: ctx.userId });
    if (error) {
      console.error(`[prospect] event failed id=${pid}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save that change." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "link") {
    const { error } = await db.from("remote_prospect_calls").insert({ prospect_id: pid, session_id: body.sessionId, company_id: p.company_id, linked_by: ctx.userId });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That call already belongs to a prospect." }, { status: 409 });
      return NextResponse.json({ error: "Couldn't link that call — it may not be yours to link." }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  }

  // A to-do is a Task assigned to the prospect's rep, so it shows in Tasks and its reminders work as any task's.
  const admin = createAdminClient();
  const { data: rep } = await admin.from("profiles").select("full_name").eq("company_id", p.company_id).eq("id", p.rep_id).maybeSingle();
  const { data: name } = await db.from("remote_prospects_current").select("name").eq("id", pid).maybeSingle();
  const { data: task, error } = await db
    .from("tasks")
    .insert({
      company_id: p.company_id,
      title: body.title,
      description: `Pipeline to-do for ${name?.name ?? "a prospect"}.\nProspect: /dashboard/remote-sales/pipeline?p=${pid}`,
      status: "To Do",
      priority: "Medium",
      due_date: body.due,
      assignee: (rep?.full_name as string | null) ?? null,
      assignee_user_id: p.rep_id,
    })
    .select("id")
    .single();
  if (error || !task) {
    console.error(`[prospect] to-do failed id=${pid}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't add the to-do." }, { status: 500 });
  }
  const { error: lErr } = await db.from("remote_prospect_tasks").insert({ prospect_id: pid, task_id: task.id, company_id: p.company_id, created_by: ctx.userId });
  if (lErr) console.error(`[prospect] to-do link failed id=${pid}: ${lErr.message}`);
  return NextResponse.json({ ok: true, taskId: String(task.id) });
}
