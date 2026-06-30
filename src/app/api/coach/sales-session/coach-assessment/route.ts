import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coach/sales-session/coach-assessment
 *
 * Admin (manager) overview: per-agent coaching signal pulled from each
 * agent's own Dissect evaluations — what they're doing well and where to
 * grow, FOR COACHING.
 *
 * §A18 / §A10 (load-bearing): this is per-agent but it is NOT a scoreboard.
 * No scores, no ranking, no cross-agent comparison. Each agent's growth is
 * relative to THEIR OWN conversations; agents are listed alphabetically so
 * order implies nothing. The strengths/growth are the REAL text from their
 * dissects (§3.4 — not invented "themes").
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
  const isCompanyAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isManager = isCompanyAdmin || profile?.sales_coach_role === "admin";
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
  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", ctx.companyId)
    .is("removed_at", null);
  const agents = (profs ?? []) as { id: string; full_name: string | null }[];
  const byId = new Map(agents.map((a) => [a.id, a.full_name]));
  const agentIds = agents.map((a) => a.id);

  // Recent dissects across the team (actor-keyed — service role, since
  // events are actor-scoped under RLS).
  const acc = new Map<
    string,
    { strengths: string[]; growth: string[]; strategies: string[]; count: number; lastAt: string | null }
  >();
  if (agentIds.length > 0) {
    const { data: events } = await admin
      .from("events")
      .select("actor, payload, created_at")
      .eq("kind", "coach.dissect_generated")
      .in("actor", agentIds)
      .order("created_at", { ascending: false })
      .limit(300);

    for (const e of events ?? []) {
      const actor = e.actor as string;
      if (!byId.has(actor)) continue;
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const cur =
        acc.get(actor) ??
        { strengths: [], growth: [], strategies: [], count: 0, lastAt: null };
      cur.count += 1;
      if (!cur.lastAt) cur.lastAt = (e.created_at as string) ?? null;
      const strengths = Array.isArray(p.strengths) ? p.strengths : [];
      for (const s of strengths) {
        const pt = (s as Record<string, unknown>)?.point;
        if (typeof pt === "string") cur.strengths.push(pt);
      }
      const growth = Array.isArray(p.growth_areas) ? p.growth_areas : [];
      for (const g of growth) {
        const op = (g as Record<string, unknown>)?.opportunity;
        if (typeof op === "string") cur.growth.push(op);
      }
      const strat = p.standout_strategy as Record<string, unknown> | null;
      if (strat && typeof strat.name === "string") cur.strategies.push(strat.name);
      acc.set(actor, cur);
    }
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
      };
    })
    // Only agents who have at least one dissect show coaching content; the
    // rest are listed as "no sessions yet" by the page. Alphabetical.
    .sort((x, y) => x.agentName.localeCompare(y.agentName));

  return NextResponse.json({ team });
}
