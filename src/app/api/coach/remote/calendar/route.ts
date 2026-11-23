import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import { clampOffset, dayBounds } from "@/lib/coach/remote/macroMode";
import { listProspects } from "@/lib/coach/remote/prospects";
import { addDays, buildWeek, weekStart, type Held } from "@/lib/coach/remote/calendar";

/**
 * GET /api/coach/remote/calendar?week=YYYY-MM-DD&scope=mine|team|<repId>&tz=<getTimezoneOffset> — one week of calls
 * booked (open prospects' next call date) and held (remote sessions), Monday first (2026-11-23). Read through the
 * caller's client: "team" is everyone RLS lets the caller see; a rep id outside their tree reads nothing.
 * A failed read is a 500, never an empty week.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-calendar", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const week = sp.get("week") ?? "";
  if (!DAY.test(week) || Number.isNaN(Date.parse(`${week}T12:00:00Z`))) return NextResponse.json({ error: "Which week?" }, { status: 400 });
  const scope = sp.get("scope") ?? "mine";
  if (scope !== "mine" && scope !== "team" && !UUID.test(scope)) return NextResponse.json({ error: "Whose calendar?" }, { status: 400 });
  const repId = scope === "mine" ? ctx.userId : scope === "team" ? undefined : scope;
  const offset = clampOffset(sp.get("tz"));
  const from = weekStart(week);
  const to = addDays(from, 6);
  const db = callerScopedDb(req) ?? (await createClient());

  const [start] = dayBounds(from, offset);
  const [, end] = dayBounds(to, offset);
  let sq = db
    .from("coaching_sessions")
    .select("id, agent_id, client_label, started_at, outcome")
    .in("context", [...REMOTE_CONTEXTS])
    .gte("started_at", start)
    .lt("started_at", end)
    .order("started_at", { ascending: true })
    .limit(500);
  if (repId) sq = sq.eq("agent_id", repId);
  const [prospects, sessions] = await Promise.all([listProspects(db, repId), sq]);
  if (prospects === null || sessions.error) {
    console.error(`[calendar] read failed user=${ctx.userId}: ${sessions.error?.message ?? "prospects"}`);
    return NextResponse.json({ error: "Couldn't load the calendar." }, { status: 500 });
  }
  const rows = (sessions.data ?? []) as Array<{ id: string; agent_id: string; client_label: string | null; started_at: string; outcome: string | null }>;

  // Which prospect each held call belongs to (a call is linked to at most one — 0303's unique session_id).
  const linkOf = new Map<string, string>();
  if (rows.length) {
    const { data: links, error } = await db.from("remote_prospect_calls").select("session_id, prospect_id").in("session_id", rows.map((r) => r.id));
    if (error) {
      console.error(`[calendar] call links failed user=${ctx.userId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't load the calendar." }, { status: 500 });
    }
    for (const l of (links ?? []) as Array<{ session_id: string; prospect_id: string }>) linkOf.set(l.session_id, l.prospect_id);
  }

  const booked = prospects
    .filter((p) => p.status === "open" && p.nextCallDate && p.nextCallDate >= from && p.nextCallDate <= to)
    .map((p) => ({ day: p.nextCallDate as string, prospectId: p.id, repId: p.repId, name: p.name, organization: p.organization, time: p.nextCallTime }));
  const nameOf = new Map(prospects.map((p) => [p.id, p.name]));
  const held: Held[] = rows.map((r) => {
    const prospectId = linkOf.get(r.id) ?? null;
    return { sessionId: r.id, repId: r.agent_id, startedAt: r.started_at, label: r.client_label, outcome: r.outcome, prospectId, prospectName: prospectId ? (nameOf.get(prospectId) ?? null) : null };
  });
  return NextResponse.json({ from, to, days: buildWeek(from, booked, held, offset), viewerId: ctx.userId });
}
