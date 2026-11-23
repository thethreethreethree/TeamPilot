import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import { computeAdoption, type AdoptionCall, type AdoptionHit } from "@/lib/coach/remote/adoption";

/**
 * GET /api/coach/remote/trackers/:id/adoption?days=30|90 — how often the team says a tracked message (2026-11-23,
 * adoption.ts). Everything is read through the CALLER's client: a manager sees the reps their tree shows, a rep sees
 * only their own calls (the stats and hits tables' RLS, 0276/0277). Any failed read is a 500 — an adoption rate built
 * on a partial read would misstate how a message is landing.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 100;

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

  const sessions = await fetchAllPagedResult<{ id: string; agent_id: string; started_at: string }>(
    (from, to) =>
      db.from("coaching_sessions").select("id, agent_id, started_at").in("context", [...REMOTE_CONTEXTS]).gte("started_at", since).order("started_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
    { label: "adoption sessions" },
  );
  if (sessions.error) return fail("sessions", sessions.error.message);
  const rows = sessions.data ?? [];
  const ids = rows.map((r) => r.id);

  // Current transcript version per call = its newest stats version; a call with no stats has not been analysed yet.
  const versionOf = new Map<string, number>();
  const hits: AdoptionHit[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    // Paged: a call can have many hits (and several stats versions), so a single capped read could drop some.
    const [st, h] = await Promise.all([
      fetchAllPagedResult<{ session_id: string; transcript_version: number }>(
        (from, to) => db.from("session_interaction_stats").select("session_id, transcript_version").in("session_id", chunk).order("session_id").order("transcript_version").range(from, to),
        { label: "adoption stats" },
      ),
      fetchAllPagedResult<{ session_id: string; transcript_version: number; id: number }>(
        (from, to) => db.from("tracker_hits").select("session_id, transcript_version, id").eq("tracker_id", id).in("session_id", chunk).order("id").range(from, to),
        { label: "adoption hits" },
      ),
    ]);
    if (st.error) return fail("stats", st.error.message);
    if (h.error) return fail("hits", h.error.message);
    for (const s of st.data ?? []) versionOf.set(s.session_id, Math.max(versionOf.get(s.session_id) ?? 0, Number(s.transcript_version)));
    for (const x of h.data ?? []) hits.push({ sessionId: x.session_id, version: Number(x.transcript_version) });
  }
  const calls: AdoptionCall[] = rows
    .filter((r) => versionOf.has(r.id))
    .map((r) => ({ sessionId: r.id, repId: r.agent_id, startedAt: r.started_at, version: versionOf.get(r.id)! }));
  const result = computeAdoption(String(tracker.created_at), calls, hits);

  const repIds = result.reps.map((r) => r.repId);
  const { data: people } = repIds.length ? await db.from("profiles").select("id, full_name").in("id", repIds) : { data: [] };
  const nameOf = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));
  return NextResponse.json({
    tracker: { id: tracker.id, name: tracker.name, createdAt: tracker.created_at },
    days,
    since,
    ...result,
    reps: result.reps.map((r) => ({ ...r, name: nameOf.get(r.repId) ?? "Unnamed teammate" })).sort((a, b) => a.name.localeCompare(b.name)),
    awaitingAnalysis: rows.length - calls.length,
  });
}
