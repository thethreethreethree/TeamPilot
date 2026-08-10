import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import {
  conversionRate,
  quotaAttainment,
  relianceReductionFromFirstCue,
  isSlippingVsBaseline,
  isSlippingSeries,
  overallQualityForSession,
  layer3InputFromPayload,
  monthKeyUtc,
  ALERT_DROP_FRACTION,
  MIN_SESSIONS,
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

  // The company's monthly deals-won quota target (the manager set it in Coaching settings). This is the view
  // where the manager who SET the quota finally sees per-rep attainment against it — /me is self-scoped, so
  // without this the quota they configured had no team-level readout. A34-guarded: no column / read error →
  // null target → every rep's quota reads "building", never a guess. UTC month, consistent with /me.
  let monthlyTarget: number | null = null;
  {
    const { data: co, error: coErr } = await sb
      .from("companies")
      .select("sales_coach_monthly_deal_target")
      .eq("id", ctx.companyId)
      .maybeSingle();
    if (!coErr || !isMissingColumnError(coErr, "sales_coach_monthly_deal_target")) {
      monthlyTarget = (co?.sales_coach_monthly_deal_target as number | null) ?? null;
    }
  }
  const monthPrefix = monthKeyUtc(new Date());

  // One query for all the team's sessions; then compute per agent in memory (cheap, no per-agent round-trips).
  // Paged: a team's sessions cross PostgREST's 1000-row cap within ~a year; an unbounded read
  // would silently truncate and undercount every downstream KPI. Fetch the full set (throws on error).
  const sessRows = await fetchAllPaged(
    (from, to) =>
      sb
        .from("coaching_sessions")
        .select("id, agent_id, outcome, deal_value, started_at, ended_at")
        .in("agent_id", memberIds)
        .order("started_at", { ascending: true })
        .range(from, to),
    { label: "team KPI sessions" },
  );

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

  // Coach-active sessions (produced ≥1 transcript segment) — the SAME filter /me applies to reliance, so a
  // rep's reliance number matches between their own view and this rollup (cross-view consistency is the whole
  // honesty thesis; a rep seeing a different figure than their manager erodes it). A no-segment session is a
  // no-coaching call whose 0 cues are not a reliance signal.
  const coachedSessions = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: segRows } = await sb
      .from("coaching_transcript_segments")
      .select("session_id")
      .in("session_id", sessionIds);
    for (const s of segRows ?? []) coachedSessions.add(s.session_id as string);
  }

  // Per-session overall quality (Layer-3 after-pitch scores) — for the quality-slippage alert trigger. One
  // query for the team; a session with no scored after-pitch simply has no entry (isSlippingSeries drops it).
  const qualityBySession = new Map<string, number | null>();
  if (memberIds.length > 0) {
    const { data: apRows } = await sb
      .from("after_pitch_summaries")
      .select("session_id, payload")
      .in("agent_id", memberIds);
    for (const r of apRows ?? []) {
      const input = layer3InputFromPayload(r.session_id as string, r.payload);
      qualityBySession.set(r.session_id as string, overallQualityForSession(input));
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
      rows
        .filter((r) => coachedSessions.has(r.sessionId)) // coach-active only — matches /me exactly
        .map((r) => ({ cueCount: cueCountBySession.get(r.sessionId) ?? 0, sessionId: r.sessionId }))
    );
    // Exception alert (founder-set threshold): this rep is ≥15% below their OWN prior baseline — on outcomes
    // (conversion) and/or on pitch quality. Two triggers because a rep can close fine while their craft
    // slips, or vice versa; a manager coaches both. Each trigger gates internally (≥2·MIN_SESSIONS + positive
    // prior), so a thin agent never trips it. Not a leaderboard signal — a "check in with this rep" flag.
    const slippingConversion = isSlippingVsBaseline(rows, conversionRate);
    const orderedQuality = rows.map((r) => qualityBySession.get(r.sessionId) ?? null);
    const slippingQuality = isSlippingSeries(orderedQuality);
    const slippingReasons: string[] = [];
    if (slippingConversion) slippingReasons.push("conversion");
    if (slippingQuality) slippingReasons.push("quality");
    // Quota attainment vs the company target (deals won THIS month ÷ target). Same UTC-month + gating as /me,
    // so a rep's number matches between their own view and the manager's rollup.
    const dealsWonThisMonth = rows.filter(
      (r) => r.outcome === "sold" && r.startedAt.slice(0, 7) === monthPrefix
    ).length;
    const quota: MetricResult = quotaAttainment(dealsWonThisMonth, monthlyTarget);
    // New-hire ramp context (spec: manager view). Factual, no invented threshold: firstSessionAt (rows are
    // ascending) + establishingBaseline = below 2·MIN_SESSIONS, the exact point where self-comparison deltas
    // and the exception alert turn on. This tells a manager "read this rep's numbers as a starting point, not
    // underperformance" — the growth-not-leaderboard principle applied to newcomers.
    const firstSessionAt = rows.length > 0 ? rows[0]!.startedAt : null;
    const establishingBaseline = rows.length < 2 * MIN_SESSIONS;
    return {
      agentId: id,
      name: (m.full_name as string | null) ?? null,
      sessionCount: rows.length,
      firstSessionAt,
      establishingBaseline,
      conversionRate: conversion,
      relianceReduction: reliance,
      quotaAttainment: quota,
      slipping: slippingReasons.length > 0,
      slippingReasons,
    };
  });

  return NextResponse.json({
    agents,
    alertDropPct: Math.round(ALERT_DROP_FRACTION * 100),
    monthlyQuotaTarget: monthlyTarget,
  });
}
