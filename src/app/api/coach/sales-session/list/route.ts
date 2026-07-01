import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coach/sales-session/list
 *
 * Phase 1 of the Sessions history. Staff see their OWN sessions; managers
 * (company admin OR sales_coach admin) see the COMPANY's, with which agent
 * ran each — for coaching VISIBILITY, never ranking (§A18): chronological
 * order, no scores. Each row carries dissect/summary/review badges from a
 * single bounded events query (no per-session cue load — that's the
 * unbounded/N+1 class). Existing data only.
 *
 * Bounded to the most recent 300 sessions; the page filters client-side.
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
    userId: auth.user.id,
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

  const admin = createAdminClient();

  let query = admin
    .from("coaching_sessions")
    .select(
      "id, agent_id, client_label, context, status, started_at, ended_at, territory, offer, outcome"
    )
    .eq("company_id", ctx.companyId)
    .order("started_at", { ascending: false })
    .limit(300);
  // Staff: only their own sessions.
  if (!ctx.isManager) {
    query = query.eq("agent_id", ctx.userId);
  }
  const { data: sessionsData, error: sErr } = await query;
  if (sErr) {
    return NextResponse.json({ degraded: true });
  }
  const sessions = sessionsData ?? [];

  // Which sessions have a dissect / summary / review — one bounded query,
  // scoped to exactly these sessions' subjects.
  const subjects = sessions.map((s) => `sales_session:${s.id}`);
  const dissect = new Set<string>();
  const summary = new Set<string>();
  const review = new Set<string>();
  // §3.4: if the badge query fails (incl. a too-long subject .in()), do NOT
  // render every session as un-dissected — flag it so the page says the
  // status is unavailable rather than asserting a false "nothing generated".
  let badgesAvailable = true;
  if (subjects.length > 0) {
    const { data: events, error: eErr } = await admin
      .from("events")
      .select("kind, subject")
      .in("kind", [
        "coach.dissect_generated",
        "coach.session_summary_generated",
        "coach.sales_review_generated",
      ])
      .in("subject", subjects);
    if (eErr) badgesAvailable = false;
    for (const e of events ?? []) {
      const sid = String(e.subject ?? "").replace("sales_session:", "");
      if (e.kind === "coach.dissect_generated") dissect.add(sid);
      else if (e.kind === "coach.session_summary_generated") summary.add(sid);
      else if (e.kind === "coach.sales_review_generated") review.add(sid);
    }
  }

  // Agent names — manager view only (per-agent visibility, not ranking).
  const names = new Map<string, string | null>();
  if (ctx.isManager) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", ctx.companyId);
    for (const p of profs ?? []) names.set(p.id as string, p.full_name as string | null);
  }

  const rows = sessions.map((s) => {
    const id = s.id as string;
    return {
      id,
      clientLabel: (s.client_label as string | null) ?? null,
      context: s.context as "in_person" | "video",
      status: s.status as "active" | "ended" | "reviewed",
      startedAt: s.started_at as string,
      endedAt: (s.ended_at as string | null) ?? null,
      territory: (s.territory as string | null) ?? null,
      offer: (s.offer as string | null) ?? null,
      outcome: (s.outcome as string | null) ?? null,
      agentName: ctx.isManager
        ? (names.get(s.agent_id as string) ?? "Unnamed")
        : null,
      hasDissect: dissect.has(id),
      hasSummary: summary.has(id),
      hasReview: review.has(id),
    };
  });

  return NextResponse.json({
    isManager: ctx.isManager,
    sessions: rows,
    badgesAvailable,
  });
}
