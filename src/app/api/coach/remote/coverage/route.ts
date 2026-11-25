import { NextRequest, NextResponse } from "next/server";
import { teamFromRequest } from "@/lib/coach/remote/teamScope";
import { createAdminClient } from "@/lib/supabase/admin";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { coverageShare } from "@/lib/coach/remote/coverageShare";

/**
 * GET /api/coach/remote/coverage?days=7|30|90 — what the team's phone/video calls cover: the share of calls each
 * tracker fired on and each topic the AI read named (2026-11-25; Gong ledger F10.11). Managers only. Every read goes
 * through the manager's OWN client, so the reporting tree and hidden calls (0337) are applied by the database — the
 * shares count only calls this manager may open. Paged/chunked: a capped read would undercount silently.
 */
export const maxDuration = 30;
const PERIODS = new Set([7, 30, 90]);
const DAY = 86_400_000;
const CHUNK = 150;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-coverage", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  // ?team=<manager> (F10.9 / F16.6): narrow to one manager's team — never wider than the caller's own access.
  const scope = await teamFromRequest(req, createAdminClient, mgr.companyId, (id) => (id === mgr.userId ? Promise.resolve(true) : treeAllowsRep(req, id)));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const inTeam = (id: string) => !scope.members || scope.members.has(id);
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  if (!PERIODS.has(days)) return NextResponse.json({ error: "Period must be 7, 30 or 90 days." }, { status: 400 });
  const since = new Date(Date.now() - days * DAY).toISOString();
  const db = callerScopedDb(req) ?? (await createClient());
  const fail = (what: string, msg: string) => {
    console.error(`[coverage] ${what} read failed company=${mgr.companyId}: ${msg}`);
    return NextResponse.json({ error: "Couldn't load what the team's calls cover." }, { status: 500 });
  };

  const { data: calls, error } = await fetchAllPagedResult<{ id: string; agent_id: string }>(
    (from, to) =>
      db
        .from("coaching_sessions")
        .select("id, agent_id")
        .eq("company_id", mgr.companyId)
        .in("context", ["phone", "video"])
        .neq("status", "active")
        .gte("started_at", since)
        .order("id", { ascending: true })
        .range(from, to),
    { label: "coverage calls", maxRows: 20_000 },
  );
  if (error) return fail("calls", error.message);
  const callIds = (calls ?? []).filter((c) => inTeam(String(c.agent_id))).map((c) => String(c.id));

  const { data: trackers, error: tErr } = await db.from("keyword_trackers").select("id, name, active").eq("company_id", mgr.companyId);
  if (tErr) return fail("trackers", tErr.message);

  const hits: Array<{ trackerId: string; sessionId: string }> = [];
  const intel: Array<{ subject: string | null; payload: unknown; created_at: string }> = [];
  for (let i = 0; i < callIds.length; i += CHUNK) {
    const ids = callIds.slice(i, i + CHUNK);
    const [h, e] = await Promise.all([
      fetchAllPagedResult<{ tracker_id: string; session_id: string }>(
        (from, to) => db.from("tracker_hits").select("tracker_id, session_id").eq("company_id", mgr.companyId).in("session_id", ids).order("id", { ascending: true }).range(from, to),
        { label: "coverage hits", maxRows: 100_000 },
      ),
      fetchAllPagedResult<{ subject: string | null; payload: unknown; created_at: string }>(
        (from, to) =>
          db
            .from("events")
            .select("subject, payload, created_at")
            .eq("kind", "coach.session_intel_generated")
            .in("subject", ids.map((id) => `sales_session:${id}`))
            .order("created_at", { ascending: false })
            .order("id", { ascending: false }) // a unique tiebreaker: rows from one transaction share created_at
            .range(from, to),
        { label: "coverage intel", maxRows: 20_000 },
      ),
    ]);
    if (h.error) return fail("tracker hits", h.error.message);
    if (e.error) return fail("topics", e.error.message);
    for (const r of h.data ?? []) hits.push({ trackerId: String(r.tracker_id), sessionId: String(r.session_id) });
    intel.push(...(e.data ?? []));
  }
  // Newest first across chunks, so each call's first event is its latest read.
  intel.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const out = coverageShare({
    callIds,
    trackers: ((trackers ?? []) as Array<{ id: string; name: string; active: boolean }>).map((t) => ({ id: String(t.id), name: t.name, active: t.active !== false })),
    hits,
    intel,
  });
  return NextResponse.json({ days, since, ...out });
}
