import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { assignmentStatus, currentDue, type Attempt } from "@/lib/coach/remote/training";

/**
 * /api/coach/remote/assignments — practice given to reps with due dates (RSS Phase 7, Gong F17.10; migration 0282).
 *   GET   → a rep: their own ("Assigned to you"); a manager: their own + every rep the tree lets them see (?team=1).
 *           ?id= → one, with its scenario (the role-play page seeds from it).
 *   POST  { scenarioId, repIds[], dueAt } (managers) → assigns; a rep already assigned that scenario is skipped.
 *   PATCH { assignmentId, dueAt } (managers) → a new due date, recorded as a row (training_due_changes).
 * Status (due / overdue / attempted / passed / not passed yet) is derived by assignmentStatus. Company-pinned (INV29);
 * manager reach asked of the tree (INV36). A rep never changes their own due date.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Training is waiting on database migration 0282.";
type A = { id: string; scenario_id: string; rep_id: string; assigned_by: string; due_at: string; created_at: string };

/** The newest this many assignments are listed; `truncated` says when there are more. */
const SHOWN = 500;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-assignments", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const one = params.get("id");
  const team = params.get("team") === "1";
  const mgr = team ? await requireSalesCoachManager(req) : null;
  if (team && !mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const admin = createAdminClient();
  let q = admin.from("training_assignments").select("id, scenario_id, rep_id, assigned_by, due_at, created_at").eq("company_id", ctx.companyId);
  if (one) q = q.eq("id", one).eq("rep_id", ctx.userId);
  else if (!team) q = q.eq("rep_id", ctx.userId);
  // A manager's team view reads every assignment, THEN keeps their tree, THEN the newest SHOWN (2026-11-26): capping the
  // company's newest 500 first let other teams' assignments push this manager's out. A rep's own list is small.
  const { data, error } = await fetchAllPagedResult<A>(
    (from, to) => q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    { label: "assignments", maxRows: 50_000 },
  );
  if (error) {
    if (MISSING.has(String((error as { code?: string }).code)) || /PGRST205|42P01|does not exist/.test(error.message)) return NextResponse.json({ available: false, reason: NOT_READY });
    console.error(`[assignments] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load assignments." }, { status: 500 });
  }
  let rows = (data ?? []) as A[];
  if (team) {
    const allowed = new Set(await treeFilterReps(req, [...new Set(rows.map((r) => String(r.rep_id)))]));
    rows = rows.filter((r) => allowed.has(String(r.rep_id)));
  }
  const truncated = rows.length > SHOWN;
  rows = rows.slice(0, SHOWN);
  if (rows.length === 0) return NextResponse.json({ available: true, assignments: [] });

  const ids = rows.map((r) => r.id);
  const [{ data: scen }, { data: changes }, { data: attempts }, { data: people }] = await Promise.all([
    admin.from("training_scenarios").select("id, title, persona, situation, focus, channel, difficulty, length_min, pass_score").eq("company_id", ctx.companyId).in("id", [...new Set(rows.map((r) => r.scenario_id))]),
    admin.from("training_due_changes").select("assignment_id, due_at").eq("company_id", ctx.companyId).in("assignment_id", ids).order("id", { ascending: true }),
    admin.from("training_attempts").select("assignment_id, score, applied, passed, created_at").eq("company_id", ctx.companyId).in("assignment_id", ids).order("created_at", { ascending: true }),
    admin.from("profiles").select("id, full_name").eq("company_id", ctx.companyId).in("id", [...new Set(rows.flatMap((r) => [r.rep_id, r.assigned_by]))]),
  ]);
  const scenById = new Map(((scen ?? []) as Array<{ id: string; pass_score: number | null } & Record<string, unknown>>).map((s) => [String(s.id), s]));
  const nameById = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name]));
  const changesBy = new Map<string, Array<{ due_at: string }>>();
  for (const c of (changes ?? []) as Array<{ assignment_id: string; due_at: string }>) changesBy.set(c.assignment_id, [...(changesBy.get(c.assignment_id) ?? []), c]);
  const attemptsBy = new Map<string, Attempt[]>();
  for (const t of (attempts ?? []) as Array<{ assignment_id: string; score: number; applied: boolean; passed: boolean | null; created_at: string }>) {
    attemptsBy.set(t.assignment_id, [...(attemptsBy.get(t.assignment_id) ?? []), { score: t.score, applied: t.applied, passed: t.passed, createdAt: t.created_at }]);
  }
  const assignments = rows.map((r) => {
    const scenario = scenById.get(String(r.scenario_id)) ?? null;
    const dueAt = currentDue(r.due_at, changesBy.get(r.id) ?? []);
    const tries = attemptsBy.get(r.id) ?? [];
    return {
      id: r.id,
      repId: r.rep_id,
      repName: nameById.get(String(r.rep_id)) ?? null,
      assignedByName: nameById.get(String(r.assigned_by)) ?? null,
      // Training by deal stage (0310): a rep who started a stage scenario themselves is its assigned_by.
      selfStarted: String(r.assigned_by) === String(r.rep_id),
      dueAt,
      scenario,
      attempts: tries,
      ...assignmentStatus({ dueAt, attempts: tries, passScore: (scenario?.pass_score as number | null) ?? null }),
    };
  });
  return NextResponse.json({ available: true, assignments, truncated });
}

function parseDue(v: unknown): string | null {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return null;
  const t = Date.parse(v);
  if (t < Date.now() - 86_400_000 || t > Date.now() + 365 * 86_400_000) return null;
  return new Date(t).toISOString();
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-assignments-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { scenarioId?: unknown; repIds?: unknown; dueAt?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId : "";
  const repIds = Array.isArray(b.repIds) ? [...new Set(b.repIds.filter((x): x is string => typeof x === "string"))].filter((id) => id !== mgr.userId) : [];
  const dueAt = parseDue(b.dueAt);
  if (!scenarioId || repIds.length === 0 || repIds.length > 100) return NextResponse.json({ error: "Pick a scenario and at least one rep." }, { status: 400 });
  if (!dueAt) return NextResponse.json({ error: "Pick a due date within the next year." }, { status: 400 });

  const admin = createAdminClient();
  const { data: scen, error: sErr } = await admin
    .from("training_scenarios")
    .select("id, retired_at")
    .eq("company_id", mgr.companyId)
    .eq("id", scenarioId)
    .maybeSingle();
  if (sErr && MISSING.has(String(sErr.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
  if (!scen || scen.retired_at) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });

  const allowed = await treeFilterReps(req, repIds);
  const { data: members } = await admin.from("profiles").select("id").eq("company_id", mgr.companyId).eq("status", "active").in("id", allowed);
  const targets = ((members ?? []) as Array<{ id: string }>).map((m) => String(m.id));
  if (targets.length === 0) return NextResponse.json({ error: "None of those reps are on your team." }, { status: 403 });
  // A plain insert of only the reps who do not already have it: Postgres refuses ON CONFLICT (even DO NOTHING) on a
  // table with an UPDATE rule (0282), and one duplicate fails a plain batch. A new due date for an existing
  // assignment is a training_due_changes row (PATCH), never a second assignment.
  const { data: had, error: hadErr } = await admin
    .from("training_assignments")
    .select("rep_id")
    .eq("company_id", mgr.companyId)
    .eq("scenario_id", scenarioId)
    .in("rep_id", targets);
  if (hadErr) {
    console.error(`[assignments] read failed: ${hadErr.message}`);
    return NextResponse.json({ error: "Couldn't assign it." }, { status: 500 });
  }
  const already = new Set(((had ?? []) as Array<{ rep_id: string }>).map((r) => String(r.rep_id)));
  const fresh = targets.filter((id) => !already.has(id));
  if (fresh.length > 0) {
    const { error } = await admin
      .from("training_assignments")
      .insert(fresh.map((rep_id) => ({ company_id: mgr.companyId, scenario_id: scenarioId, rep_id, assigned_by: mgr.userId, due_at: dueAt })));
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Someone assigned this to one of those reps at the same moment. Try again." }, { status: 409 });
    }
    if (error) {
      console.error(`[assignments] insert failed: ${error.message}`);
      return NextResponse.json({ error: "Couldn't assign it." }, { status: 500 });
    }
  }
  return NextResponse.json({ assigned: fresh.length, alreadyAssigned: already.size, skipped: repIds.length - targets.length });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-assignments-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { assignmentId?: unknown; dueAt?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const dueAt = parseDue(b.dueAt);
  if (typeof b.assignmentId !== "string" || !dueAt) return NextResponse.json({ error: "Which assignment, and a due date within the next year." }, { status: 400 });
  const admin = createAdminClient();
  const { data: a } = await admin.from("training_assignments").select("id, rep_id").eq("company_id", mgr.companyId).eq("id", b.assignmentId).maybeSingle();
  if (!a || (await treeFilterReps(req, [String(a.rep_id)])).length === 0) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  const { error } = await admin.from("training_due_changes").insert({ company_id: mgr.companyId, assignment_id: a.id, due_at: dueAt, changed_by: mgr.userId });
  if (error) {
    console.error(`[assignments] due change failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't change the due date." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, dueAt });
}
