import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { computeAdoption, currentGoal, goalStatus } from "@/lib/coach/remote/adoption";
import { readAdoptionInputs } from "@/lib/coach/remote/adoptionRead";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterRepsChecked } from "@/lib/api/treeAccess";
import { companyPeople, teamMembers, teamsIn } from "@/lib/coach/remote/teamScope";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coach/remote/trackers/adoption-board?days=30|90 — every active tracked message on one board: its share of
 * calls, its goal and whether it's on target (2026-11-23; ledger F18.1 "Initiative board"). The same reads and rules
 * as one tracker's Adoption view (adoptionRead.ts, adoption.ts), done once for all trackers. Caller's client: a
 * manager's tree, a rep's own calls. A failed read is a 500.
 *
 * ?by=team (2026-11-26; ledger F18.4 "adoption by team"): managers only — each message's share of calls per team (a
 * manager and everyone below them), for the teams whose manager the caller's reporting tree allows. The service role
 * only reads the org chart (who reports to whom); every call and hit is still read through the caller's client.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "tracker-adoption-board", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const days = req.nextUrl.searchParams.get("days") === "30" ? 30 : 90;
  const db = callerScopedDb(req) ?? (await createClient());
  const fail = (what: string, msg?: string) => {
    console.error(`[adoption-board] ${what} failed company=${ctx.companyId}: ${msg ?? ""}`);
    return NextResponse.json({ error: "Couldn't build the adoption board." }, { status: 500 });
  };

  const { data: trackers, error: tErr } = await db.from("keyword_trackers_live").select("id, name, created_at") /* 0352: live only */.order("name").limit(200);
  if (tErr) {
    if (["PGRST205", "42P01"].includes(String(tErr.code))) return NextResponse.json({ days, rows: [] });
    return fail("trackers", tErr.message);
  }
  const list = (trackers ?? []) as Array<{ id: string; name: string; created_at: string }>;
  if (!list.length) return NextResponse.json({ days, rows: [] });

  const windowStart = Date.now() - days * 86_400_000;
  const startOf = (t: { created_at: string }) => new Date(Math.max(Date.parse(t.created_at), windowStart)).toISOString();
  const earliest = list.map(startOf).sort()[0]!;
  const inputs = await readAdoptionInputs(db, list.map((t) => t.id), earliest);
  if (!inputs) return fail("reads");

  const { data: goalRows, error: gErr } = await db.from("tracker_goals").select("id, tracker_id, direction, target_pct").in("tracker_id", list.map((t) => t.id)).order("id", { ascending: false }).limit(1000);
  if (gErr && !["PGRST205", "42P01"].includes(String(gErr.code))) return fail("goals", gErr.message);
  const goalsBy = new Map<string, Array<{ id: number; direction: string | null; target_pct: number | null }>>();
  for (const g of (gErr ? [] : goalRows ?? []) as Array<{ id: number; tracker_id: string; direction: string | null; target_pct: number | null }>) {
    goalsBy.set(g.tracker_id, [...(goalsBy.get(g.tracker_id) ?? []), g]);
  }

  let teams: Array<{ id: string; name: string; members: Set<string> }> | null = null;
  if (req.nextUrl.searchParams.get("by") === "team") {
    if (!(await requireSalesCoachManager(req))) return NextResponse.json({ error: "Managers only." }, { status: 403 });
    let people: Awaited<ReturnType<typeof companyPeople>>;
    try {
      people = await companyPeople(createAdminClient(), ctx.companyId);
    } catch (e) {
      return fail("org chart", e instanceof Error ? e.message : String(e));
    }
    const found = teamsIn(people);
    const visible = await treeFilterRepsChecked(req, found.map((t) => t.id));
    if (visible === null) return fail("tree check");
    const { data: names, error: nErr } = visible.length ? await db.from("profiles").select("id, full_name").in("id", visible) : { data: [], error: null };
    if (nErr) return fail("team names", nErr.message);
    const nameOf = new Map(((names ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name ?? "A manager"]));
    teams = visible
      .map((id) => ({ id, name: `${nameOf.get(id) ?? "A manager"}'s team`, members: teamMembers(id, people) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const rows = list.map((t) => {
    const hits = inputs.hitsByTracker.get(t.id) ?? [];
    const r = computeAdoption(startOf(t), inputs.calls, hits);
    const goal = currentGoal(goalsBy.get(t.id) ?? []);
    // By team: the same rule over each team's calls only (calls this caller may see).
    const byTeam = teams?.map((tm) => {
      const x = computeAdoption(startOf(t), inputs.calls.filter((c) => tm.members.has(String(c.repId))), hits);
      return { teamId: tm.id, calls: x.calls, said: x.said, rate: x.rate };
    });
    return { id: t.id, name: t.name, since: startOf(t), calls: r.calls, said: r.said, rate: r.rate, goal, goalStatus: goalStatus(goal, r.rate), ...(byTeam ? { byTeam } : {}) };
  });
  return NextResponse.json({ days, rows, ...(teams ? { teams: teams.map(({ id, name }) => ({ id, name })) } : {}) });
}
