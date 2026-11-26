import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { currentSteps, currentVersion, parseSteps, SUMMARY_MAX, TITLE_MAX, type Step, type StepRow } from "@/lib/coach/remote/courses";
import { assignPractice, scenariosUsable } from "@/lib/coach/remote/coursePractice";

/**
 * /api/coach/remote/courses — training courses: ordered lessons a manager writes (2026-11-26, Gong F17.1; migration 0355).
 *   GET                                     (managers) → every course in the company with its current lessons.
 *   POST  { title, summary?, steps[] }      (managers) → a new course, version 1.
 *   PUT   { courseId, steps[] }             (managers) → a new VERSION of the lessons (§3.1: rows appended, never edited).
 *   PATCH { courseId, retire: true }        (managers) → retired: no new assignments; reps keep theirs.
 * Company-pinned on every statement (service role, INV29). Courses hold no call or customer data, so no hide check.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Courses are waiting on database migration 0355.";
const missing = (e: { code?: string; message: string }) => MISSING.has(String(e.code)) || /PGRST205|42P01|does not exist/.test(e.message);
type Course = { id: string; title: string; summary: string | null; retired_at: string | null; created_at: string; created_by: string };

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-courses", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const admin = createAdminClient();
  const { data: courses, error } = await fetchAllPagedResult<Course>(
    (from, to) => admin.from("training_courses").select("id, title, summary, retired_at, created_at, created_by").eq("company_id", mgr.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    { label: "courses", maxRows: 5_000 },
  );
  if (error) {
    if (missing(error)) return NextResponse.json({ available: false, reason: NOT_READY });
    console.error(`[courses] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load courses." }, { status: 500 });
  }
  const list = courses ?? [];
  const stepsBy = new Map<string, StepRow[]>();
  const ids = list.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error: sErr } = await fetchAllPagedResult<StepRow & { course_id: string; id: number }>(
      (from, to) => admin.from("training_course_steps").select("course_id, version, position, step_uid, title, body, kind, scenario_id, library_item_id, link_url, id").eq("company_id", mgr.companyId).in("course_id", ids.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "course steps", maxRows: 200_000 },
    );
    if (sErr) {
      console.error(`[courses] steps read failed: ${sErr.message}`);
      return NextResponse.json({ error: "Couldn't load courses." }, { status: 500 });
    }
    for (const r of data ?? []) stepsBy.set(String(r.course_id), [...(stepsBy.get(String(r.course_id)) ?? []), r]);
  }
  return NextResponse.json({
    available: true,
    courses: list.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      retired: !!c.retired_at,
      createdAt: c.created_at,
      version: currentVersion(stepsBy.get(c.id) ?? []),
      steps: currentSteps(stepsBy.get(c.id) ?? []),
    })),
  });
}

async function insertVersion(admin: ReturnType<typeof createAdminClient>, companyId: string, courseId: string, version: number, steps: Step[], by: string) {
  return admin.from("training_course_steps").insert(
    steps.map((s, i) => ({ company_id: companyId, course_id: courseId, version, position: i + 1, step_uid: s.uid, kind: s.kind, scenario_id: s.scenarioId, library_item_id: s.libraryItemId ?? null, link_url: s.linkUrl ?? null, title: s.title, body: s.body, created_by: by })),
  );
}

/** A practice step must name a live scenario of this company (0357). Null = fine; else the response to send. */
async function badScenarios(admin: ReturnType<typeof createAdminClient>, companyId: string, steps: Step[]) {
  const ok = await scenariosUsable(admin, companyId, steps.flatMap((s) => (s.scenarioId ? [s.scenarioId] : [])));
  if (ok === null) return NextResponse.json({ error: "Couldn't save the course." }, { status: 500 });
  if (!ok) return NextResponse.json({ error: "One of the practice scenarios isn't available any more. Pick another." }, { status: 400 });
  // A lesson's library call must be in a COMPANY folder and not removed (0359), or no rep could reach it.
  const items = [...new Set(steps.flatMap((s) => (s.libraryItemId ? [s.libraryItemId] : [])))];
  if (items.length) {
    const { data: rows, error } = await admin.from("library_items").select("id, folder_id").eq("company_id", companyId).in("id", items);
    const { data: gone, error: gErr } = await admin.from("library_item_removals").select("item_id").eq("company_id", companyId).in("item_id", items);
    const folderIds = [...new Set(((rows ?? []) as Array<{ folder_id: string }>).map((r) => String(r.folder_id)))];
    const { data: folders, error: fErr } = folderIds.length ? await admin.from("library_folders").select("id, is_company").eq("company_id", companyId).in("id", folderIds) : { data: [], error: null };
    if (error || gErr || fErr) return NextResponse.json({ error: "Couldn't save the course." }, { status: 500 });
    const companyFolder = new Set(((folders ?? []) as Array<{ id: string; is_company: boolean }>).filter((f) => f.is_company).map((f) => String(f.id)));
    const removed = new Set(((gone ?? []) as Array<{ item_id: string }>).map((g) => String(g.item_id)));
    const usable = new Set(((rows ?? []) as Array<{ id: string; folder_id: string }>).filter((r) => companyFolder.has(String(r.folder_id)) && !removed.has(String(r.id))).map((r) => String(r.id)));
    if (!items.every((id) => usable.has(id))) return NextResponse.json({ error: "A lesson's library call must be in a company folder. Pick one from the company library." }, { status: 400 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-courses-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const b = await readBody(req);
  if (!b) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const summary = typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : null;
  if (!title || title.length > TITLE_MAX) return NextResponse.json({ error: `Give the course a title of up to ${TITLE_MAX} characters.` }, { status: 400 });
  if (summary && summary.length > SUMMARY_MAX) return NextResponse.json({ error: `Keep the summary under ${SUMMARY_MAX} characters.` }, { status: 400 });
  const parsed = parseSteps(b.steps, randomUUID);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = createAdminClient();
  const bad = await badScenarios(admin, mgr.companyId, parsed.steps);
  if (bad) return bad;
  const { data: course, error } = await admin.from("training_courses").insert({ company_id: mgr.companyId, title, summary, created_by: mgr.userId }).select("id").single();
  if (error || !course) {
    if (error && missing(error)) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[courses] create failed: ${error?.message}`);
    return NextResponse.json({ error: "Couldn't save the course." }, { status: 500 });
  }
  const { error: sErr } = await insertVersion(admin, mgr.companyId, course.id, 1, parsed.steps, mgr.userId);
  if (sErr) {
    // No course without lessons: the empty course is retired (the one change a course allows), never left assignable.
    console.error(`[courses] lessons insert failed: ${sErr.message}`);
    await admin.from("training_courses").update({ retired_at: new Date().toISOString() }).eq("company_id", mgr.companyId).eq("id", course.id);
    return NextResponse.json({ error: "Couldn't save the course." }, { status: 500 });
  }
  return NextResponse.json({ id: course.id, version: 1 });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-courses-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const b = await readBody(req);
  if (!b || typeof b.courseId !== "string") return NextResponse.json({ error: "Which course?" }, { status: 400 });
  const parsed = parseSteps(b.steps, randomUUID);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const admin = createAdminClient();
  const { data: course } = await admin.from("training_courses").select("id, retired_at").eq("company_id", mgr.companyId).eq("id", b.courseId).maybeSingle();
  if (!course || course.retired_at) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const bad = await badScenarios(admin, mgr.companyId, parsed.steps);
  if (bad) return bad;
  const { data: top, error: vErr } = await admin.from("training_course_steps").select("version").eq("company_id", mgr.companyId).eq("course_id", course.id).order("version", { ascending: false }).limit(1);
  if (vErr) {
    console.error(`[courses] version read failed: ${vErr.message}`);
    return NextResponse.json({ error: "Couldn't save the course." }, { status: 500 });
  }
  const version = currentVersion((top ?? []) as Array<{ version: number }>) + 1;
  // Two managers saving at once: the second insert meets the unique (course, version, position) and is told to reload.
  const { error } = await insertVersion(admin, mgr.companyId, course.id, version, parsed.steps, mgr.userId);
  if (error?.code === "23505") return NextResponse.json({ error: "Someone saved this course at the same moment. Reload it and try again." }, { status: 409 });
  if (error) {
    console.error(`[courses] new version failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the course." }, { status: 500 });
  }
  // A practice step added in this version reaches the reps already taking the course, due with their course and assigned
  // by the manager who gave them the course — whose tree was checked then — not by whoever edits it. Nothing about
  // these reps is returned.
  const practice = parsed.steps.flatMap((s) => (s.scenarioId ? [s.scenarioId] : []));
  let practiceAssigned = true;
  if (practice.length) {
    const { data: takers, error: tErr } = await fetchAllPagedResult<{ rep_id: string; due_at: string; assigned_by: string; id: string }>(
      (from, to) => admin.from("training_course_assignments").select("rep_id, due_at, assigned_by, id").eq("company_id", mgr.companyId).eq("course_id", course.id).order("id", { ascending: true }).range(from, to),
      { label: "course takers", maxRows: 50_000 },
    );
    const r = tErr ? "failed" : await assignPractice(admin, mgr.companyId, { scenarioIds: practice, reps: (takers ?? []).map((t) => ({ repId: String(t.rep_id), dueAt: t.due_at, by: String(t.assigned_by) })) });
    if (r !== "ok") {
      console.error(`[courses] practice for existing reps: ${tErr?.message ?? r}`);
      practiceAssigned = false;
    }
  }
  // The lessons are saved either way; a practice that didn't reach every rep is said, never hidden (§1.5.3: fail loud).
  return NextResponse.json({ id: course.id, version, practiceAssigned });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-courses-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const b = await readBody(req);
  if (!b || typeof b.courseId !== "string" || b.retire !== true) return NextResponse.json({ error: "Which course to retire?" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("training_courses")
    .update({ retired_at: new Date().toISOString() })
    .eq("company_id", mgr.companyId)
    .eq("id", b.courseId)
    .is("retired_at", null)
    .select("id");
  if (error) {
    console.error(`[courses] retire failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't retire the course." }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
