import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { computeAdoption, currentGoal, goalStatus } from "@/lib/coach/remote/adoption";
import { readAdoptionInputs } from "@/lib/coach/remote/adoptionRead";

/**
 * GET /api/coach/remote/trackers/adoption-board?days=30|90 — every active tracked message on one board: its share of
 * calls, its goal and whether it's on target (2026-11-23; ledger F18.1 "Initiative board"). The same reads and rules
 * as one tracker's Adoption view (adoptionRead.ts, adoption.ts), done once for all trackers. Caller's client: a
 * manager's tree, a rep's own calls. A failed read is a 500.
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

  const rows = list.map((t) => {
    const r = computeAdoption(startOf(t), inputs.calls, inputs.hitsByTracker.get(t.id) ?? []);
    const goal = currentGoal(goalsBy.get(t.id) ?? []);
    return { id: t.id, name: t.name, since: startOf(t), calls: r.calls, said: r.said, rate: r.rate, goal, goalStatus: goalStatus(goal, r.rate) };
  });
  return NextResponse.json({ days, rows });
}
