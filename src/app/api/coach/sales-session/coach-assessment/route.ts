import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateDissectContent } from "@/lib/coach/v5/coachAssessmentAggregate";
import { getAllTimeKpi } from "@/lib/data/doorlog";
import {
  PRACTICE_EVENT_KIND,
  summarizePracticeForManager,
  summarizeTeamPractice,
  type ManagerPracticeSummary,
} from "@/lib/coach/v5/practiceAnalytics";

/**
 * GET /api/coach/sales-session/coach-assessment
 *
 * Admin (manager) overview: per-agent coaching signal pulled from each
 * agent's own Dissect evaluations — what they're doing well and where to
 * grow, FOR COACHING.
 *
 * §A18 / §A10 (load-bearing): the COACHING NOTES this route returns are NOT a
 * scoreboard — no ranking, no cross-agent comparison; each agent's growth is
 * relative to THEIR OWN conversations; agents are listed alphabetically so order
 * implies nothing. The strengths/growth are the REAL text from their dissects
 * (§3.4 — not invented "themes"). (The gamified Sales ELO Rating shown alongside
 * on the page is a separate feature — each rep vs a fixed standard, not peers —
 * fetched from /elo, not this route; see coach-assessment page 2026-07-07.)
 *
 * 403s non-managers — the endpoint IS the gate the page reads.
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
  const isManager = isSalesCoachManager({
    role,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  return {
    ok: true as const,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

function uniqTrim(values: unknown[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
      if (out.length >= max) break;
    }
  }
  return out;
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
      { error: "Coach Assessment is for admins." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Company agents (alphabetical — order carries no meaning, §A18).
  // §3.4: a failed query must NOT render as "no assessments yet" — degrade
  // honestly so the page shows an error, not a fake empty team.
  const { data: profs, error: profErr } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", ctx.companyId)
    .is("removed_at", null);
  if (profErr) {
    return NextResponse.json({ degraded: true });
  }
  const agents = (profs ?? []) as { id: string; full_name: string | null }[];

  // Per-rep coaching signal (founder-approved 2026-08-06 — "per-rep, no migration", replacing the old
  // TEAM-WIDE recent-300 window). The old window pooled 300 dissects across the whole team, so an active
  // teammate could starve a quieter rep to count 0 + no content despite real dissects (worsened by the
  // no-minimum-length build). Fix splits the two concerns the old code conflated:
  //   • COUNT  — an EXACT per-rep count via `head:true, count:'exact'` (no rows transferred; immune to the
  //     PostgREST 300/1000 row cap that a `.select()` would silently hit — the trap the old comment warned of).
  //   • CONTENT — that rep's OWN recent-N dissects for the strengths/growth/strategy themes.
  // Queried per rep in parallel. §3.4: any failed query degrades the WHOLE page honestly (never renders a
  // rep as a fake-empty "no sessions yet").
  const DISSECT_CONTENT_N = 50;
  type DoorKpi = { doorsKnocked: number; presentations: number; sold: number };
  type Agg = {
    strengths: string[];
    growth: string[];
    strategies: string[];
    count: number;
    lastAt: string | null;
    // Per-rep door activity (founder 2026-08-26: "show their door metrics on the manager dashboard"). Objective
    // ACTIVITY (knocked / presentations / sold), distinct from the growth-based coaching grade — manager visibility,
    // not a coaching leaderboard (§A18 still holds: alphabetical, coaching is per-own-growth). Best-effort: a KPI
    // read error yields null (not a false 0, §3.4) and never degrades the coaching page.
    doorKpi: DoorKpi | null;
    // Per-rep practice growth (founder 2026-08-26). §A18 "closest to the feedback": the manager sees each rep's
    // practice ACTIVITY + growth DIRECTION over time (to coach from), rendered UNRANKED — never a score leaderboard.
    // Best-effort: a read error yields null (not a false 0, §3.4).
    practice: ManagerPracticeSummary | null;
  };
  const PRACTICE_N = 200; // recent practice attempts per rep to derive the growth direction (bounded)
  const perRep = await Promise.all(
    agents.map(
      async (a): Promise<{ id: string; agg: Agg } | { error: true }> => {
        const [countRes, contentRes, doorKpi, practiceRes] = await Promise.all([
          admin
            .from("events")
            .select("*", { count: "exact", head: true })
            .eq("kind", "coach.dissect_generated")
            .eq("actor", a.id),
          admin
            .from("events")
            .select("payload, created_at")
            .eq("kind", "coach.dissect_generated")
            .eq("actor", a.id)
            .order("created_at", { ascending: false })
            .limit(DISSECT_CONTENT_N),
          // Best-effort — door metrics must never blank the coaching page (null on any error, never a false 0).
          getAllTimeKpi(a.id).catch(() => null),
          // Best-effort — practice growth must never blank the coaching page. company_id-pinned as well as
          // actor-pinned (defense-in-depth: symmetric with the write's tenant tag; keeps the read correct if a rep
          // ever spans companies — INV15-style tenant scoping on the read).
          admin
            .from("events")
            .select("payload, created_at")
            .eq("kind", PRACTICE_EVENT_KIND)
            .eq("actor", a.id)
            .eq("company_id", ctx.companyId)
            .order("created_at", { ascending: false })
            .limit(PRACTICE_N),
        ]);
        if (countRes.error || contentRes.error) return { error: true };
        const content = aggregateDissectContent(contentRes.data ?? []);
        const practice = practiceRes.error
          ? null
          : summarizePracticeForManager((practiceRes.data ?? []) as { payload: unknown; created_at: unknown }[]);
        const agg: Agg = { ...content, count: countRes.count ?? 0, doorKpi, practice };
        return { id: a.id, agg };
      }
    )
  );
  // §3.4 honest degrade: if ANY rep's query failed, don't show a partial team as if complete.
  if (perRep.some((r) => "error" in r)) {
    return NextResponse.json({ degraded: true });
  }
  const acc = new Map<string, Agg>();
  for (const r of perRep) {
    if ("id" in r) acc.set(r.id, r.agg);
  }

  const team = agents
    .map((a) => {
      const d = acc.get(a.id);
      return {
        agentId: a.id,
        agentName: a.full_name ?? "Unnamed",
        dissectCount: d?.count ?? 0,
        strengths: uniqTrim(d?.strengths ?? [], 6),
        growthAreas: uniqTrim(d?.growth ?? [], 6),
        strategies: uniqTrim(d?.strategies ?? [], 4),
        lastAt: d?.lastAt ?? null,
        doorKpi: d?.doorKpi ?? null,
        practice: d?.practice ?? null,
      };
    })
    // Only agents who have at least one dissect show coaching content; the
    // rest are listed as "no sessions yet" by the page. Alphabetical.
    .sort((x, y) => x.agentName.localeCompare(y.agentName));

  // Team practice rollup (founder's "team-level data for the meeting") — a pure AGGREGATE over the per-rep practice
  // summaries already computed, no individual named/rankable (§A18-safest). Honest zeros when nobody has practiced.
  const teamPractice = summarizeTeamPractice(
    team.map((t) => t.practice).filter((p): p is ManagerPracticeSummary => p !== null),
  );

  return NextResponse.json({ team, teamPractice });
}
