import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { currentSteps, currentVersion, parseSteps, SUMMARY_MAX, TITLE_MAX, type StepRow } from "@/lib/coach/remote/courses";

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
      (from, to) => admin.from("training_course_steps").select("course_id, version, position, step_uid, title, body, id").eq("company_id", mgr.companyId).in("course_id", ids.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
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

async function insertVersion(admin: ReturnType<typeof createAdminClient>, companyId: string, courseId: string, version: number, steps: Array<{ uid: string; title: string; body: string }>, by: string) {
  return admin.from("training_course_steps").insert(
    steps.map((s, i) => ({ company_id: companyId, course_id: courseId, version, position: i + 1, step_uid: s.uid, kind: "lesson", title: s.title, body: s.body, created_by: by })),
  );
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
  return NextResponse.json({ id: course.id, version });
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
