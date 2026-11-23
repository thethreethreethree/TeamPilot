import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { computeAdoption, currentGoal, goalStatus } from "@/lib/coach/remote/adoption";
import { readAdoptionInputs } from "@/lib/coach/remote/adoptionRead";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coach/remote/trackers/:id/adoption?days=30|90 — how often the team says a tracked message (2026-11-23,
 * adoption.ts). Everything is read through the CALLER's client: a manager sees the reps their tree shows, a rep sees
 * only their own calls (the stats and hits tables' RLS, 0276/0277). Any failed read is a 500 — an adoption rate built
 * on a partial read would misstate how a message is landing.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "tracker-adoption", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
  const days = req.nextUrl.searchParams.get("days") === "30" ? 30 : 90;
  const db = callerScopedDb(req) ?? (await createClient());
  const fail = (what: string, msg?: string) => {
    console.error(`[tracker-adoption] ${what} failed tracker=${id}: ${msg ?? ""}`);
    return NextResponse.json({ error: "Couldn't work out adoption for this tracker." }, { status: 500 });
  };

  const { data: tracker, error: tErr } = await db.from("keyword_trackers").select("id, name, created_at").eq("id", id).maybeSingle();
  if (tErr) return fail("tracker", tErr.message);
  if (!tracker) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
  const since = new Date(Math.max(Date.parse(String(tracker.created_at)), Date.now() - days * 86_400_000)).toISOString();

  // The shared reads (adoptionRead.ts): the same counting as the board of all trackers.
  const inputs = await readAdoptionInputs(db, [id], since);
  if (!inputs) return fail("reads");
  const calls = inputs.calls;
  const hits = inputs.hitsByTracker.get(id) ?? [];
  const result = computeAdoption(String(tracker.created_at), calls, hits);

  // The goal (0318), if a manager set one. A missing table (0318 not applied) is no goal; any other failure is a 500.
  const { data: goalRows, error: gErr } = await db.from("tracker_goals").select("id, direction, target_pct").eq("tracker_id", id).order("id", { ascending: false }).limit(1);
  if (gErr && !["PGRST205", "42P01"].includes(String(gErr.code))) return fail("goal", gErr.message);
  const goal = gErr ? null : currentGoal((goalRows ?? []) as Array<{ id: number; direction: string | null; target_pct: number | null }>);

  const repIds = result.reps.map((r) => r.repId);
  const { data: people } = repIds.length ? await db.from("profiles").select("id, full_name").in("id", repIds) : { data: [] };
  const nameOf = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));
  return NextResponse.json({
    tracker: { id: tracker.id, name: tracker.name, createdAt: tracker.created_at },
    days,
    since,
    ...result,
    reps: result.reps.map((r) => ({ ...r, name: nameOf.get(r.repId) ?? "Unnamed teammate" })).sort((a, b) => a.name.localeCompare(b.name)),
    awaitingAnalysis: inputs.sessionsInWindow - calls.length,
    goal,
    goalStatus: goalStatus(goal, result.rate),
    canSetGoal: !!(await requireSalesCoachManager(req)),
  });
}

/**
 * PUT { direction: "at_least" | "at_most", targetPct: 0-100 } or { clear: true } — a manager sets or clears the
 * message's goal (0318). Appends a row (§3.1); the tracker must be this company's.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "tracker-goal-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
  let b: { direction?: unknown; targetPct?: unknown; clear?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const clear = b.clear === true;
  const direction = b.direction === "at_least" || b.direction === "at_most" ? b.direction : null;
  const target = Number(b.targetPct);
  if (!clear && (!direction || !Number.isInteger(target) || target < 0 || target > 100)) {
    return NextResponse.json({ error: "Choose 'at least' or 'at most' and a whole percentage from 0 to 100." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: t, error: tErr } = await admin.from("keyword_trackers").select("id").eq("company_id", mgr.companyId).eq("id", id).maybeSingle();
  if (tErr) {
    console.error(`[tracker-goal] tracker read failed: ${tErr.message}`);
    return NextResponse.json({ error: "Couldn't save the goal." }, { status: 500 });
  }
  if (!t) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
  const { error } = await admin
    .from("tracker_goals")
    .insert({ company_id: mgr.companyId, tracker_id: id, direction: clear ? null : direction, target_pct: clear ? null : target, set_by: mgr.userId });
  if (error) {
    if (["PGRST205", "42P01"].includes(String(error.code))) return NextResponse.json({ error: "Goals are waiting on database migration 0318." }, { status: 503 });
    console.error(`[tracker-goal] write failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the goal." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
