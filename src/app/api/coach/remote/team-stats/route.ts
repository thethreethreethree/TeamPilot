import { NextRequest, NextResponse } from "next/server";
import { teamFromRequest } from "@/lib/coach/remote/teamScope";
import { createAdminClient } from "@/lib/supabase/admin";
import { treeAllowsRepChecked } from "@/lib/api/treeAccess";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { teamCallStats, type StatRow } from "@/lib/coach/remote/teamStats";

/**
 * GET /api/coach/remote/team-stats?days=7|30|90 — per rep and team-wide averages of the interaction stats over the
 * period's phone/video calls (2026-11-25; ledger F10.9). Managers only. Read through the manager's OWN client:
 * session_interaction_stats' RLS (0277) lets a manager see reps in their reporting tree only, so the table can't list
 * anyone they couldn't open. Paged (a capped read would undercount silently).
 */
const PERIODS = new Set([7, 30, 90]);
const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-team-stats", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  // ?team=<manager> (F10.9 / F16.6): narrow to one manager's team — never wider than the caller's own access.
  const scope = await teamFromRequest(req, createAdminClient, mgr.companyId, (id) => (id === mgr.userId ? Promise.resolve(true) : treeAllowsRepChecked(req, id)));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const inTeam = (id: string) => !scope.members || scope.members.has(id);
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  if (!PERIODS.has(days)) return NextResponse.json({ error: "Period must be 7, 30 or 90 days." }, { status: 400 });
  const since = new Date(Date.now() - days * DAY).toISOString();

  const db = callerScopedDb(req) ?? (await createClient());
  type R = {
    session_id: string; rep_id: string; transcript_version: number; talk_ratio_time: number | null; longest_rep_monologue_ms: number | null;
    longest_customer_story_ms: number | null; interactivity: number | null; patience_ms: number | null; rep_questions_per_hour: number | null;
  };
  const { data, error } = await fetchAllPagedResult<R>(
    (from, to) =>
      db
        .from("session_interaction_stats")
        .select("session_id, rep_id, transcript_version, talk_ratio_time, longest_rep_monologue_ms, longest_customer_story_ms, interactivity, patience_ms, rep_questions_per_hour, coaching_sessions!inner(started_at, context)")
        .eq("company_id", mgr.companyId)
        .gte("coaching_sessions.started_at", since)
        .in("coaching_sessions.context", ["phone", "video"])
        .order("id", { ascending: true })
        .range(from, to),
    { label: "team-stats", maxRows: 50_000 },
  );
  if (error) {
    console.error(`[team-stats] read failed company=${mgr.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load team call stats." }, { status: 500 });
  }
  const num = (v: unknown) => (v == null ? null : Number(v));
  const rows: StatRow[] = (data ?? []).filter((r) => inTeam(String(r.rep_id))).map((r) => ({
    sessionId: String(r.session_id),
    repId: String(r.rep_id),
    version: Number(r.transcript_version),
    talkRatioTime: num(r.talk_ratio_time),
    longestRepMonologueMs: num(r.longest_rep_monologue_ms),
    longestCustomerStoryMs: num(r.longest_customer_story_ms),
    interactivity: num(r.interactivity),
    patienceMs: num(r.patience_ms),
    repQuestionsPerHour: num(r.rep_questions_per_hour),
  }));
  const repIds = [...new Set(rows.map((r) => r.repId))];
  const names = new Map<string, string>();
  if (repIds.length) {
    const { data: profs, error: pErr } = await db.from("profiles").select("id, full_name").in("id", repIds);
    if (pErr) {
      console.error(`[team-stats] names read failed company=${mgr.companyId}: ${pErr.message}`);
      return NextResponse.json({ error: "Couldn't load team call stats." }, { status: 500 });
    }
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) names.set(String(p.id), p.full_name ?? "Unnamed teammate");
  }
  return NextResponse.json({ days, ...teamCallStats(rows, names) });
}
