import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  conversionRate,
  relianceReductionFromFirstCue,
  type KpiSessionRow,
  type MetricResult,
} from "@/lib/coach/kpi/compute";

/**
 * GET /api/coach/kpi/team — the MANAGER rollup (SalesCoach-KPI-System.md).
 *
 * Manager-only (isSalesCoachManager). Returns a per-agent summary for the manager's team: session count +
 * two headline reads (conversion rate + reliance-reduction slope). Growth-framed, NOT a leaderboard — the
 * client presents it as per-agent detail, ranking available but never the default frame (per the spec's
 * non-negotiable design principle). All the same Understanding Gates apply, so a thin agent reads "building".
 */
export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Manager gate — read the caller's role, then check.
  const { data: me } = await sb
    .from("profiles")
    .select("role, sales_coach_role, company_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const manager = isSalesCoachManager({
    role: (me?.role as string | null) ?? null,
    sales_coach_role: (me?.sales_coach_role as string | null) ?? null,
    company_id: (me?.company_id as string | null) ?? null,
  });
  if (!manager) {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }

  // The team = sales-coach members in the manager's company.
  const { data: members } = await sb
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", ctx.companyId)
    .not("sales_coach_role", "is", null);

  const memberIds = (members ?? []).map((m) => m.id as string);
  if (memberIds.length === 0) return NextResponse.json({ agents: [] });

  // One query for all the team's sessions; then compute per agent in memory (cheap, no per-agent round-trips).
  const { data: sessRows } = await sb
    .from("coaching_sessions")
    .select("id, agent_id, outcome, deal_value, started_at, ended_at")
    .in("agent_id", memberIds)
    .order("started_at", { ascending: true });

  // Cue counts per session (for reliance) — one query for the team's sessions.
  const sessionIds = (sessRows ?? []).map((s) => s.id as string);
  const cueCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: cueRows } = await sb
      .from("coaching_cues")
      .select("session_id")
      .in("session_id", sessionIds);
    for (const c of cueRows ?? []) {
      const sid = c.session_id as string;
      cueCountBySession.set(sid, (cueCountBySession.get(sid) ?? 0) + 1);
    }
  }

  const byAgent = new Map<string, KpiSessionRow[]>();
  for (const s of sessRows ?? []) {
    const aid = s.agent_id as string;
    const list = byAgent.get(aid) ?? [];
    list.push({
      sessionId: s.id as string,
      outcome: (s.outcome as KpiSessionRow["outcome"]) ?? null,
      dealValue: s.deal_value === null || s.deal_value === undefined ? null : Number(s.deal_value),
      startedAt: s.started_at as string,
      endedAt: (s.ended_at as string | null) ?? null,
    });
    byAgent.set(aid, list);
  }

  const agents = (members ?? []).map((m) => {
    const id = m.id as string;
    const rows = byAgent.get(id) ?? [];
    const conversion: MetricResult = conversionRate(rows);
    const reliance: MetricResult = relianceReductionFromFirstCue(
      rows.map((r) => ({ cueCount: cueCountBySession.get(r.sessionId) ?? 0, sessionId: r.sessionId }))
    );
    return {
      agentId: id,
      name: (m.full_name as string | null) ?? null,
      sessionCount: rows.length,
      conversionRate: conversion,
      relianceReduction: reliance,
    };
  });

  return NextResponse.json({ agents });
}
