import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  const allowed = [
    "title",
    "description",
    "department",
    "assignee",
    "status",
    "priority",
    "ai_priority_score",
    "impact_level",
    "blocker_reason",
    "due_date",
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

  const { error } = await ctx.supabase
    .from("tasks")
    .update(safePatch)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}
