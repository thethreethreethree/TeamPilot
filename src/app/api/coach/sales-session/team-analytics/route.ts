import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coach/sales-session/team-analytics
 *
 * Company-wide Sales Coach aggregates for MANAGERS (sales_coach admin OR
 * company admin). Returns 403 for everyone else — so the endpoint IS the
 * gate the Analytics page reads.
 *
 * §A18 / §A10 (load-bearing here): AGGREGATE ONLY. No per-agent
 * breakdown, no leaderboard, no naming of who needed how many cues. The
 * team series is anonymized (each bar is *a* session, not *whose*). The
 * only per-person number is a COUNT of active coaches — a headcount, not
 * a ranking.
 *
 * §3.4: every number is real; sparse data shows as zero / "not enough
 * yet", never a fabricated trend.
 *
 * Aggregation runs on the service-role client (after the manager check)
 * because review events are actor-scoped under RLS — a manager couldn't
 * read teammates' review events otherwise. The manager check is the gate;
 * the query is company-scoped.
 */
async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isCompanyAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isManager = isCompanyAdmin || profile?.sales_coach_role === "admin";
  return {
    ok: true as const,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function GET() {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "Team analytics is for managers only." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Company agents (for the review-event count, which is actor-keyed).
  const { data: profs } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", ctx.companyId);
  const agentIds = (profs ?? []).map((p) => p.id as string);

  // Company-wide sessions.
  const { data: sessionsData } = await admin
    .from("coaching_sessions")
    .select("id, status, started_at, agent_id")
    .eq("company_id", ctx.companyId);
  const sessions = sessionsData ?? [];

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsTotal = sessions.length;
  const sessionsThisWeek = sessions.filter(
    (s) => new Date(s.started_at as string).getTime() >= weekAgo
  ).length;
  // Headcount of coaches who've run ≥1 session — a count, not a ranking.
  const activeCoaches = new Set(sessions.map((s) => s.agent_id)).size;

  // Cues per session (for the total + the anonymized trend).
  const ids = sessions.map((s) => s.id as string);
  let cuesTotal = 0;
  const cueBySession = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cues } = await admin
      .from("coaching_cues")
      .select("session_id")
      .in("session_id", ids);
    for (const c of cues ?? []) {
      const sid = c.session_id as string;
      cuesTotal++;
      cueBySession.set(sid, (cueBySession.get(sid) ?? 0) + 1);
    }
  }

  // Reviews generated across the team.
  let reviewsGenerated = 0;
  if (agentIds.length > 0) {
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "coach.sales_review_generated")
      .in("actor", agentIds);
    reviewsGenerated = count ?? 0;
  }

  // Anonymized team cue-reliance trend — completed sessions only, oldest
  // → newest. No agent_id leaves the server.
  const series = sessions
    .filter((s) => s.status === "ended" || s.status === "reviewed")
    .sort(
      (a, b) =>
        new Date(a.started_at as string).getTime() -
        new Date(b.started_at as string).getTime()
    )
    .map((s) => ({
      sessionId: s.id as string,
      startedAt: s.started_at as string,
      cueCount: cueBySession.get(s.id as string) ?? 0,
    }));
  const avgCues =
    series.length > 0
      ? Math.round(
          (series.reduce((a, s) => a + s.cueCount, 0) / series.length) * 10
        ) / 10
      : 0;

  return NextResponse.json({
    team: {
      sessionsTotal,
      sessionsThisWeek,
      activeCoaches,
      cuesTotal,
      reviewsGenerated,
      avgCues,
    },
    series,
  });
}
