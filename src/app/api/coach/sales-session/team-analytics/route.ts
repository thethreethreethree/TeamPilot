import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coach/sales-session/team-analytics
 *
 * Company-wide Sales Coach aggregates for MANAGERS (sales_coach admin OR
 * company admin). 403s everyone else — the endpoint IS the gate the page
 * reads.
 *
 * §A18 / §A10: AGGREGATE ONLY. No per-agent breakdown, no leaderboard.
 * The trend is anonymized (each bar is *a* session, not *whose*); the
 * only per-person number is a COUNT of active coaches.
 *
 * §3.4 + §A21 (post-audit rebuild 2026-06-29): headline totals come from
 * count-head queries (exact at any scale, since coaching_sessions has
 * company_id). The session-detail window — needed for active-coach count,
 * cue total, and the trend — is bounded to SESSION_WINDOW with a DISCLOSED
 * `capped` flag (no silent cap). The trend uses per-session count-head,
 * the same method as getCueRelianceSeries (no bulk row-load). On any
 * headline query error we return { degraded: true } rather than render a
 * failure as "0" (§3.4).
 *
 * KNOWN LIMIT (disclosed, not silent): coaching_cues has no company_id, so
 * cuesTotal is counted over the windowed session ids via .in(); past
 * SESSION_WINDOW it is window-scoped (flagged by `capped`). The clean
 * structural fix is a company_id column on coaching_cues — deferred to a
 * migration decision.
 */

const SESSION_WINDOW = 500; // explicit, disclosed cap on the detail window
const TREND_N = 50; // most-recent completed sessions shown in the trend

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
  // Headline-query failures degrade the whole view (§3.4 — don't show a
  // half-true dashboard). The trend below is best-effort and does NOT
  // degrade, since it's a directional visual, not a headline number.
  let degraded = false;

  // Company agents — for the actor-keyed review count. Bounded naturally
  // by company headcount.
  const profRes = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", ctx.companyId);
  if (profRes.error) degraded = true;
  const agentIds = (profRes.data ?? []).map((p) => p.id as string);

  // Exact headline totals (sessions has company_id → count-head is exact).
  const totalRes = await admin
    .from("coaching_sessions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.companyId);
  if (totalRes.error) degraded = true;
  const sessionsTotal = totalRes.count ?? 0;

  const weekAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const weekRes = await admin
    .from("coaching_sessions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.companyId)
    .gte("started_at", weekAgoIso);
  if (weekRes.error) degraded = true;
  const sessionsThisWeek = weekRes.count ?? 0;

  let reviewsGenerated = 0;
  if (agentIds.length > 0) {
    const revRes = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "coach.sales_review_generated")
      .in("actor", agentIds);
    if (revRes.error) degraded = true;
    reviewsGenerated = revRes.count ?? 0;
  }

  // Bounded session-detail window (active coaches, cue total, trend).
  const sessRes = await admin
    .from("coaching_sessions")
    .select("id, status, started_at, agent_id")
    .eq("company_id", ctx.companyId)
    .order("started_at", { ascending: false })
    .limit(SESSION_WINDOW);
  if (sessRes.error) degraded = true;
  const windowSessions = sessRes.data ?? [];
  const capped = windowSessions.length === SESSION_WINDOW;
  // Headcount of coaches who've run ≥1 session in the window — a count,
  // not a ranking.
  const activeCoaches = new Set(windowSessions.map((s) => s.agent_id)).size;

  // Cue total over the window — single count-head, no cue rows loaded.
  const windowIds = windowSessions.map((s) => s.id as string);
  let cuesTotal = 0;
  if (windowIds.length > 0) {
    const cuesRes = await admin
      .from("coaching_cues")
      .select("id", { count: "exact", head: true })
      .in("session_id", windowIds);
    if (cuesRes.error) degraded = true;
    cuesTotal = cuesRes.count ?? 0;
  }

  if (degraded) {
    return NextResponse.json({ degraded: true });
  }

  // Anonymized trend — most-recent TREND_N completed sessions, oldest →
  // newest, per-session count-head (same method as getCueRelianceSeries,
  // §A21). Best-effort: a single failed count shows that bar as 0 rather
  // than failing the whole view.
  const completed = windowSessions
    .filter((s) => s.status === "ended" || s.status === "reviewed")
    .slice(0, TREND_N)
    .sort(
      (a, b) =>
        new Date(a.started_at as string).getTime() -
        new Date(b.started_at as string).getTime()
    );
  const series: Array<{
    sessionId: string;
    startedAt: string;
    cueCount: number;
  }> = [];
  for (const s of completed) {
    const cRes = await admin
      .from("coaching_cues")
      .select("id", { count: "exact", head: true })
      .eq("session_id", s.id as string);
    series.push({
      sessionId: s.id as string,
      startedAt: s.started_at as string,
      cueCount: cRes.count ?? 0,
    });
  }
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
      capped,
    },
    series,
  });
}
