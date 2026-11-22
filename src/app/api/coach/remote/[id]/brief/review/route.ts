import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { getSession } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/remote/:id/brief/review { briefId, items: [{ text, due }] } — the Next Meeting checklist "must be
 * reviewed" (MACRO-MODE-SPEC). The rep sends the list as THEY want it (kept, edited, dropped, added); each item becomes a
 * Task assigned to the call's rep with its due date — reminders live in the one Tasks module — and, when the call
 * belongs to a prospect, the task is that prospect's to-do too. The review itself is an append-only row (0303).
 *
 * Everything is written through the CALLER's client: tasks' own RLS and event trigger apply exactly as for any task,
 * and the review/link inserts are checked by 0303's policies (the brief and prospect must be visible to the caller).
 */
const Body = z.object({
  briefId: z.string().uuid(),
  items: z
    .array(z.object({ text: z.string().trim().min(1).max(200), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }))
    .max(12),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-brief-review", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  // The checklist is the rep's to review (0304 enforces it too): a manager reading it in Macro Mode must not use up
  // the rep's review, nor skip the rep's ask-first step.
  if (session.agentId !== ctx.userId) {
    return NextResponse.json({ error: "Only the rep who took this call can review its checklist." }, { status: 403 });
  }
  const { data: brief } = await db.from("remote_call_briefs").select("id").eq("id", body.briefId).eq("session_id", id).maybeSingle();
  if (!brief) return NextResponse.json({ error: "Checklist not found." }, { status: 404 });
  // Once per brief (0304 unique index): checked BEFORE any task is created, so a second save or a double-click can't
  // create every task twice.
  const { data: prior } = await db.from("remote_checklist_reviews").select("kept").eq("brief_id", body.briefId).limit(1).maybeSingle();
  if (prior) return NextResponse.json({ error: "This checklist has already been reviewed.", kept: prior.kept }, { status: 409 });

  const { data: link } = await db.from("remote_prospect_calls").select("prospect_id").eq("session_id", id).maybeSingle();
  const admin = createAdminClient();
  const { data: rep } = await admin
    .from("profiles")
    .select("full_name")
    .eq("company_id", session.companyId)
    .eq("id", session.agentId)
    .maybeSingle();

  const kept: Array<{ text: string; due: string | null; task_id: string | null }> = [];
  for (const item of body.items) {
    const { data: task, error } = await db
      .from("tasks")
      .insert({
        company_id: session.companyId,
        title: item.text,
        description: `Before the next meeting — from the call "${session.clientLabel ?? "Untitled"}" on ${session.startedAt.slice(0, 10)}.\nCall: /dashboard/remote-sales/calls/${id}`,
        status: "To Do",
        priority: "Medium",
        due_date: item.due,
        assignee: (rep?.full_name as string | null) ?? null,
        assignee_user_id: session.agentId,
      })
      .select("id")
      .single();
    if (error || !task) {
      console.error(`[brief-review] task insert failed session=${id}: ${error?.message ?? "no row"}`);
      kept.push({ text: item.text, due: item.due, task_id: null });
      continue;
    }
    kept.push({ text: item.text, due: item.due, task_id: String(task.id) });
    if (link?.prospect_id) {
      const { error: lErr } = await db.from("remote_prospect_tasks").insert({
        prospect_id: link.prospect_id,
        task_id: task.id,
        company_id: session.companyId,
        created_by: ctx.userId,
      });
      if (lErr) console.error(`[brief-review] prospect link failed session=${id}: ${lErr.message}`);
    }
  }
  const { error: rErr } = await db.from("remote_checklist_reviews").insert({
    brief_id: body.briefId,
    company_id: session.companyId,
    reviewed_by: ctx.userId,
    kept,
  });
  if (rErr) {
    console.error(`[brief-review] review insert failed session=${id}: ${rErr.message}`);
    // The tasks exist; say so, so the rep does not save again and duplicate them.
    return NextResponse.json({ error: "Your to-dos were added, but the review itself didn't save — don't save again.", kept }, { status: 500 });
  }
  const failed = kept.filter((k) => !k.task_id).length;
  return NextResponse.json({ kept, failed });
}
