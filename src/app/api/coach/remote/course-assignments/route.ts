import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { courseProgress, currentSteps, type StepRow } from "@/lib/coach/remote/courses";
import { assignPractice, practiceStates } from "@/lib/coach/remote/coursePractice";
import { currentDue } from "@/lib/coach/remote/training";
import { treeAllowsRepChecked, treeFilterRepsChecked } from "@/lib/api/treeAccess";

/**
 * /api/coach/remote/course-assignments — courses given to reps (2026-11-26, Gong F17.1; migration 0355).
 *   GET                (anyone) → your own courses: lessons, which you've done, progress.
 *   GET ?team=1        (managers) → every assignment for reps the reporting tree lets you see, with progress.
 *   POST { courseId, repIds[], dueAt }   (managers) → assigns; a rep who already has it is skipped.
 *   PUT  { assignmentId, stepUid }       (the rep) → marks one lesson of the CURRENT version done.
 *   PATCH { assignmentId, dueAt }        (managers) → a new due date, as a row (0358); current = the latest.
 * Progress is derived by courseProgress (§2.2). Company-pinned (INV29); manager reach asked of the tree (INV36), and a
 * tree check that can't be answered is a 503, never an empty team. Courses hold no call or customer data.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Courses are waiting on database migration 0355.";
const missing = (e: { code?: string; message: string }) => MISSING.has(String(e.code)) || /PGRST205|42P01|does not exist/.test(e.message);
type A = { id: string; course_id: string; rep_id: string; assigned_by: string; due_at: string; created_at: string };
type Admin = ReturnType<typeof createAdminClient>;

async function stepsFor(admin: Admin, companyId: string, courseIds: string[]) {
  const by = new Map<string, StepRow[]>();
  for (let i = 0; i < courseIds.length; i += 150) {
    const { data, error } = await fetchAllPagedResult<StepRow & { course_id: string; id: number }>(
      (from, to) => admin.from("training_course_steps").select("course_id, version, position, step_uid, title, body, kind, scenario_id, id").eq("company_id", companyId).in("course_id", courseIds.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "course steps", maxRows: 200_000 },
    );
    if (error) return null;
    for (const r of data ?? []) by.set(String(r.course_id), [...(by.get(String(r.course_id)) ?? []), r]);
  }
  return by;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-course-assignments", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const team = new URL(req.url).searchParams.get("team") === "1";
  const mgr = team ? await requireSalesCoachManager(req) : null;
  if (team && !mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const admin = createAdminClient();
  const fail = (what: string, msg: string) => {
    console.error(`[course-assignments] ${what} failed: ${msg}`);
    return NextResponse.json({ error: "Couldn't load courses." }, { status: 500 });
  };

  const { data, error } = await fetchAllPagedResult<A>(
    (from, to) => {
      let q = admin.from("training_course_assignments").select("id, course_id, rep_id, assigned_by, due_at, created_at").eq("company_id", ctx.companyId);
      if (!team) q = q.eq("rep_id", ctx.userId);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    },
    { label: "course assignments", maxRows: 50_000 },
  );
  if (error) {
    if (missing(error)) return NextResponse.json({ available: false, reason: NOT_READY });
    return fail("assignments", error.message);
  }
  let rows = data ?? [];
  if (team) {
    const allowed = await treeFilterRepsChecked(req, [...new Set(rows.map((r) => String(r.rep_id)))]);
    if (allowed === null) return NextResponse.json({ error: "Couldn't check your reporting tree — try again." }, { status: 503 });
    const ok = new Set(allowed);
    rows = rows.filter((r) => ok.has(String(r.rep_id)) && String(r.rep_id) !== mgr!.userId);
  }
  if (rows.length === 0) return NextResponse.json({ available: true, assignments: [] });

  const courseIds = [...new Set(rows.map((r) => String(r.course_id)))];
  const steps = await stepsFor(admin, ctx.companyId, courseIds);
  if (!steps) return fail("steps", "read");
  const courseById = new Map<string, { id: string; title: string; summary: string | null; retired_at: string | null }>();
  for (let i = 0; i < courseIds.length; i += 150) {
    const { data: courses, error: cErr } = await admin.from("training_courses").select("id, title, summary, retired_at").eq("company_id", ctx.companyId).in("id", courseIds.slice(i, i + 150));
    if (cErr) return fail("courses", cErr.message);
    for (const c of (courses ?? []) as Array<{ id: string; title: string; summary: string | null; retired_at: string | null }>) courseById.set(String(c.id), c);
  }
  const doneBy = new Map<string, Set<string>>();
  const ids = rows.map((r) => r.id);
  // The current due date: the latest training_course_due_changes row, else the assignment's own (0358).
  const dueChanges = new Map<string, Array<{ due_at: string }>>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data: ch, error: chErr } = await fetchAllPagedResult<{ assignment_id: string; due_at: string; id: number }>(
      (from, to) => admin.from("training_course_due_changes").select("assignment_id, due_at, id").eq("company_id", ctx.companyId).in("assignment_id", ids.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "course due changes", maxRows: 200_000 },
    );
    if (chErr) return fail("due changes", chErr.message);
    for (const c of ch ?? []) dueChanges.set(String(c.assignment_id), [...(dueChanges.get(String(c.assignment_id)) ?? []), c]);
  }
  for (let i = 0; i < ids.length; i += 150) {
    const { data: done, error: dErr } = await fetchAllPagedResult<{ assignment_id: string; step_uid: string; id: number }>(
      (from, to) => admin.from("training_step_completions").select("assignment_id, step_uid, id").eq("company_id", ctx.companyId).in("assignment_id", ids.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "course completions", maxRows: 200_000 },
    );
    if (dErr) return fail("completions", dErr.message);
    for (const d of done ?? []) {
      const k = String(d.assignment_id);
      if (!doneBy.has(k)) doneBy.set(k, new Set());
      doneBy.get(k)!.add(String(d.step_uid));
    }
  }
  const people = [...new Set(rows.flatMap((r) => [String(r.rep_id), String(r.assigned_by)]))];
  // Practice steps (0357): each rep's practice of each scenario the current courses name — done by its own verdict.
  const currentOf = new Map(courseIds.map((id) => [id, currentSteps(steps.get(id) ?? [])]));
  const practice = await practiceStates(
    admin,
    ctx.companyId,
    rows.map((r) => String(r.rep_id)),
    [...currentOf.values()].flatMap((l) => l.flatMap((x) => (x.scenarioId ? [x.scenarioId] : []))),
  );
  if (!practice) return fail("practice", "read");
  const nameOf = new Map<string, string | null>();
  for (let i = 0; i < people.length; i += 150) {
    const { data: profs, error: pErr } = await admin.from("profiles").select("id, full_name").eq("company_id", ctx.companyId).in("id", people.slice(i, i + 150));
    if (pErr) return fail("names", pErr.message);
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) nameOf.set(String(p.id), p.full_name);
  }

  return NextResponse.json({
    available: true,
    assignments: rows.map((r) => {
      const c = courseById.get(String(r.course_id));
      const list = currentOf.get(String(r.course_id)) ?? [];
      // A lesson is done when the rep marked it; a practice when its practice counts as done. Never the other way.
      const marked = doneBy.get(r.id) ?? new Set<string>();
      const pOf = (scenarioId: string | null) => (scenarioId ? practice.get(`${r.rep_id}|${scenarioId}`) : undefined);
      const dueAt = currentDue(r.due_at, dueChanges.get(r.id) ?? []);
      const done = new Set(list.filter((x) => (x.kind === "practice" ? pOf(x.scenarioId)?.done : marked.has(x.uid))).map((x) => x.uid));
      return {
        id: r.id,
        courseId: r.course_id,
        title: c?.title ?? "Course",
        summary: c?.summary ?? null,
        retired: !!c?.retired_at,
        repId: r.rep_id,
        repName: nameOf.get(String(r.rep_id)) ?? null,
        assignedByName: nameOf.get(String(r.assigned_by)) ?? null,
        dueAt,
        // The rep sees the lessons; the manager's table needs only the progress.
        steps: team
          ? undefined
          : list.map((s) => ({ ...s, done: done.has(s.uid), practiceAssignmentId: pOf(s.scenarioId)?.assignmentId ?? null, practiceState: pOf(s.scenarioId)?.state ?? null })),
        ...courseProgress({ steps: list, doneUids: done, dueAt }),
      };
    }),
  });
}

function parseDue(v: unknown): string | null {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return null;
  const t = Date.parse(v);
  if (t < Date.now() - 86_400_000 || t > Date.now() + 365 * 86_400_000) return null;
  return new Date(t).toISOString();
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-course-assignments-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { courseId?: unknown; repIds?: unknown; dueAt?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const courseId = typeof b.courseId === "string" ? b.courseId : "";
  const repIds = Array.isArray(b.repIds) ? [...new Set(b.repIds.filter((x): x is string => typeof x === "string"))].filter((id) => id !== mgr.userId) : [];
  const dueAt = parseDue(b.dueAt);
  if (!courseId || repIds.length === 0 || repIds.length > 100) return NextResponse.json({ error: "Pick a course and at least one rep." }, { status: 400 });
  if (!dueAt) return NextResponse.json({ error: "Pick a due date within the next year." }, { status: 400 });
  const admin = createAdminClient();
  const { data: course, error: cErr } = await admin.from("training_courses").select("id, retired_at").eq("company_id", mgr.companyId).eq("id", courseId).maybeSingle();
  if (cErr && missing(cErr)) return NextResponse.json({ error: NOT_READY }, { status: 503 });
  if (!course || course.retired_at) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const allowed = await treeFilterRepsChecked(req, repIds);
  if (allowed === null) return NextResponse.json({ error: "Couldn't check your reporting tree — try again." }, { status: 503 });
  const { data: members, error: mErr } = allowed.length ? await admin.from("profiles").select("id").eq("company_id", mgr.companyId).in("id", allowed) : { data: [], error: null };
  if (mErr) {
    console.error(`[course-assignments] members read failed: ${mErr.message}`);
    return NextResponse.json({ error: "Couldn't assign it." }, { status: 500 });
  }
  const targets = ((members ?? []) as Array<{ id: string }>).map((m) => String(m.id));
  if (targets.length === 0) return NextResponse.json({ error: "None of those reps are on your team." }, { status: 403 });
  // Plain insert of only the reps without it: the table has an UPDATE rule, so Postgres refuses ON CONFLICT (as 0282).
  const { data: had, error: hErr } = await admin.from("training_course_assignments").select("rep_id").eq("company_id", mgr.companyId).eq("course_id", courseId).in("rep_id", targets);
  if (hErr) {
    console.error(`[course-assignments] read failed: ${hErr.message}`);
    return NextResponse.json({ error: "Couldn't assign it." }, { status: 500 });
  }
  const already = new Set(((had ?? []) as Array<{ rep_id: string }>).map((r) => String(r.rep_id)));
  const fresh = targets.filter((id) => !already.has(id));
  if (fresh.length) {
    const { error } = await admin.from("training_course_assignments").insert(fresh.map((rep_id) => ({ company_id: mgr.companyId, course_id: courseId, rep_id, assigned_by: mgr.userId, due_at: dueAt })));
    if (error?.code === "23505") return NextResponse.json({ error: "Someone assigned this to one of those reps at the same moment. Try again." }, { status: 409 });
    if (error) {
      console.error(`[course-assignments] insert failed: ${error.message}`);
      return NextResponse.json({ error: "Couldn't assign it." }, { status: 500 });
    }
    // The course's practice steps come with it, due with the course (0357).
    const steps = await stepsFor(admin, mgr.companyId, [courseId]);
    const scen = steps ? currentSteps(steps.get(courseId) ?? []).flatMap((x) => (x.scenarioId ? [x.scenarioId] : [])) : null;
    const r = scen === null ? "failed" : await assignPractice(admin, mgr.companyId, { scenarioIds: scen, reps: fresh.map((repId) => ({ repId, dueAt, by: mgr.userId })) });
    if (r !== "ok") {
      console.error(`[course-assignments] practice assign: ${r}`);
      return NextResponse.json({ error: "The course was assigned, but its practice scenarios weren't. Assign them from Scenarios below.", assigned: fresh.length }, { status: 502 });
    }
  }
  return NextResponse.json({ assigned: fresh.length, alreadyAssigned: already.size, skipped: repIds.length - targets.length });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-course-assignments-done", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let b: { assignmentId?: unknown; stepUid?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof b.assignmentId !== "string" || typeof b.stepUid !== "string") return NextResponse.json({ error: "Which lesson?" }, { status: 400 });
  const admin = createAdminClient();
  // Only the rep it was given to marks a lesson done — a manager can't tick a rep's training for them.
  const { data: a } = await admin.from("training_course_assignments").select("id, course_id").eq("company_id", ctx.companyId).eq("id", b.assignmentId).eq("rep_id", ctx.userId).maybeSingle();
  if (!a) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const steps = await stepsFor(admin, ctx.companyId, [String(a.course_id)]);
  if (!steps) return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  const step = currentSteps(steps.get(String(a.course_id)) ?? []).find((s) => s.uid === b.stepUid);
  if (!step) return NextResponse.json({ error: "That lesson isn't in this course any more. Reload it." }, { status: 409 });
  if (step.kind === "practice") return NextResponse.json({ error: "A practice step is done when you practice it." }, { status: 400 });
  const { error } = await admin.from("training_step_completions").insert({ company_id: ctx.companyId, assignment_id: a.id, step_uid: b.stepUid, rep_id: ctx.userId });
  if (error && error.code !== "23505") {
    console.error(`[course-assignments] completion failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-course-assignments-write", windowMs: 60_000, max: 20 });
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
  if (typeof b.assignmentId !== "string" || !dueAt) return NextResponse.json({ error: "Which course, and a due date within the next year." }, { status: 400 });
  const admin = createAdminClient();
  const { data: a } = await admin.from("training_course_assignments").select("id, rep_id").eq("company_id", mgr.companyId).eq("id", b.assignmentId).maybeSingle();
  if (!a) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const allowed = await treeAllowsRepChecked(req, String(a.rep_id));
  if (allowed === null) return NextResponse.json({ error: "Couldn't check your reporting tree — try again." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const { error } = await admin.from("training_course_due_changes").insert({ company_id: mgr.companyId, assignment_id: a.id, due_at: dueAt, changed_by: mgr.userId });
  if (error) {
    console.error(`[course-assignments] due change failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't change the due date." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, dueAt });
}
