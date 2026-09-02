import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { byOrgRank } from "@/lib/roles";
import {
  conversionRate,
  quotaAttainment,
  relianceReductionFromFirstCue,
  isSlippingVsBaseline,
  isSlippingSeries,
  overallQualityForSession,
  layer3InputFromPayload,
  objectionInputFromPayload,
  objectionsPerSession,
  objectionResolutionRate,
  recommendationInputFromPayload,
  recommendationUptake,
  prospectKeyOf,
  followUpRate,
  salesCycleLengthDays,
  latestSummaryPerSession,
  monthKeyUtc,
  ALERT_DROP_FRACTION,
  MIN_SESSIONS,
  type KpiSessionRow,
  type MetricResult,
  type ObjectionInput,
  type RecommendationInput,
  type ProspectSessionInput,
} from "@/lib/coach/kpi/compute";

/**
 * GET /api/coach/kpi/team — the MANAGER rollup (SalesCoach-KPI-System.md).
 *
 * Manager-only (isSalesCoachManager). Returns a per-agent summary for the manager's team: session count +
 * two headline reads (conversion rate + reliance-reduction slope). Growth-framed, NOT a leaderboard — the
 * client presents it as per-agent detail, ranking available but never the default frame (per the spec's
 * non-negotiable design principle). All the same Understanding Gates apply, so a thin agent reads "building".
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const ctx = await resolveApiAuth(req);
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

  // The team = sales-coach members in the manager's company. `role` is selected so the roster can default to the
  // org hierarchy order (C-Suite → Frontline), consistent with every other team list (founder 2026-08-29).
  const { data: members } = await sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("company_id", ctx.companyId)
    .not("sales_coach_role", "is", null);

  // Default the roster to the org hierarchy (C-Suite → Frontline), then A→Z — the page can re-sort by a metric.
  const orderedMembers = [...(members ?? [])].sort(
    byOrgRank((m) => m.role as string | null, (m) => m.full_name as string | null)
  );
  const memberIds = orderedMembers.map((m) => m.id as string);
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
  // A34 (audit F4): audio_duration_seconds (0210) can be absent on a code-ahead-of-migration deploy. If so,
  // retry WITHOUT it and fall back to the wall-clock (the mapper reads `?? null`) — serve the whole team KPI
  // rather than 500 it all. Mirrors the monthlyTarget guard above. fetchAllPaged wraps the error but keeps the
  // column-named "does not exist" message, which isMissingColumnError matches (verified).
  const loadSessRows = (durCol: string) =>
    fetchAllPaged(
      (from, to) =>
        sb
          .from("coaching_sessions")
          // Cast the dynamic select to the with-column literal so the typed client infers the row shape; at
          // runtime the without-column variant simply omits it and the mapper reads `?? null` (A34 degrade).
          .select(
            `id, agent_id, outcome, deal_value, started_at, ended_at, client_label${durCol}` as "id, agent_id, outcome, deal_value, started_at, ended_at, client_label, audio_duration_seconds",
          )
          .in("agent_id", memberIds)
          .order("started_at", { ascending: true })
          .range(from, to),
      { label: "team KPI sessions" },
    );
  let sessRows;
  try {
    sessRows = await loadSessRows(", audio_duration_seconds");
  } catch (e) {
    if (isMissingColumnError(e as Parameters<typeof isMissingColumnError>[0], "audio_duration_seconds")) {
      sessRows = await loadSessRows("");
    } else throw e;
  }

  // Cue counts per session (for reliance) — one query for the team's sessions.
  const sessionIds = (sessRows ?? []).map((s) => s.id as string);
  const cueCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    // Paged (was unbounded, capped at 1000) — cue rows across the team's sessions feed per-session reliance;
    // a cap silently zeroed cues for sessions past the first 1000 rows. Ordered by the uuid `id` PK.
    const cueRows = await fetchAllPaged(
      (from, to) =>
        sb.from("coaching_cues").select("id, session_id").in("session_id", sessionIds).order("id").range(from, to),
      { label: "team KPI cues" },
    ).catch(() => null);
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
    // Paged (was unbounded, capped at 1000) — this is the SAME reliance-critical read as /me: transcript_segments
    // is the highest-volume table, so the cap dropped whole sessions from `coachedSessions`, breaking the
    // rep-vs-manager reliance consistency this block's own comment calls the whole honesty thesis. Order by `id`.
    const segRows = await fetchAllPaged(
      (from, to) =>
        sb.from("coaching_transcript_segments").select("id, session_id").in("session_id", sessionIds).order("id").range(from, to),
      { label: "team KPI segments" },
    ).catch(() => null);
    for (const s of segRows ?? []) coachedSessions.add(s.session_id as string);
  }

  // Per-session overall quality (Layer-3 after-pitch scores) — for the quality-slippage alert trigger — PLUS the
  // per-agent Objections + Recommendation-uptake rollup (founder: surface the new /me metrics to the manager
  // roster). All three read the SAME after_pitch_summaries payloads in ONE query (agent_id added so we can group
  // per rep) — no extra round-trip. A session with no scored after-pitch simply has no quality entry, and a
  // payload with no objection tally / flagged focus contributes nothing to those metrics (honest exclusion).
  const qualityBySession = new Map<string, number | null>();
  const objectionRowsByAgent = new Map<string, ObjectionInput[]>();
  const recRowsByAgent = new Map<string, RecommendationInput[]>();
  // The session start time (for chronological ordering of recommendation-uptake pairs), from the sessions read.
  const startBySession = new Map<string, string>();
  for (const s of sessRows ?? []) startBySession.set(s.id as string, s.started_at as string);
  if (memberIds.length > 0) {
    // Paged (was unbounded, capped at 1000). after_pitch_summaries is APPEND-ONLY, so a re-generated session has
    // MULTIPLE rows — `latestSummaryPerSession` collapses to the latest per session (the table's "current
    // summary"), so quality/objections/uptake count each call ONCE (no double-count). `created_at` selected to
    // pick the latest. Order by the uuid `id` PK so range paging returns each row once.
    const apRows = await fetchAllPaged(
      (from, to) =>
        sb.from("after_pitch_summaries").select("session_id, agent_id, created_at, payload").in("agent_id", memberIds).order("id").range(from, to),
      { label: "team KPI after-pitch summaries" },
    ).catch(() => null);
    for (const r of latestSummaryPerSession(apRows ?? [])) {
      const sid = r.session_id as string;
      const aid = r.agent_id as string;
      qualityBySession.set(sid, overallQualityForSession(layer3InputFromPayload(sid, r.payload)));
      const obj = objectionInputFromPayload(sid, r.payload);
      if (obj) (objectionRowsByAgent.get(aid) ?? objectionRowsByAgent.set(aid, []).get(aid)!).push(obj);
      const start = startBySession.get(sid);
      if (start) {
        const rec = recommendationInputFromPayload(sid, start, r.payload);
        (recRowsByAgent.get(aid) ?? recRowsByAgent.set(aid, []).get(aid)!).push(rec);
      }
    }
  }

  const byAgent = new Map<string, KpiSessionRow[]>();
  // Prospect inputs (client_label) per agent, for Follow-up rate + Sales cycle — same source rows, no extra read.
  const prospectRowsByAgent = new Map<string, ProspectSessionInput[]>();
  for (const s of sessRows ?? []) {
    const aid = s.agent_id as string;
    const list = byAgent.get(aid) ?? [];
    list.push({
      sessionId: s.id as string,
      outcome: (s.outcome as KpiSessionRow["outcome"]) ?? null,
      dealValue: s.deal_value === null || s.deal_value === undefined ? null : Number(s.deal_value),
      startedAt: s.started_at as string,
      endedAt: (s.ended_at as string | null) ?? null,
      audioDurationSeconds: (s.audio_duration_seconds as number | null) ?? null,
    });
    byAgent.set(aid, list);
    (prospectRowsByAgent.get(aid) ?? prospectRowsByAgent.set(aid, []).get(aid)!).push({
      sessionId: s.id as string,
      prospectKey: prospectKeyOf((s as { client_label?: unknown }).client_label),
      startedAt: s.started_at as string,
      outcome: (s.outcome as KpiSessionRow["outcome"]) ?? null,
    });
  }

  const agents = orderedMembers.map((m) => {
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
    // The new /me metrics, computed per rep from the SAME payloads (founder: managers compare these across reps).
    // Same functions + gates as /me, so a rep's number matches between their own view and this rollup.
    const objRows = objectionRowsByAgent.get(id) ?? [];
    const recRows = recRowsByAgent.get(id) ?? [];
    const prospectRows = prospectRowsByAgent.get(id) ?? [];
    return {
      agentId: id,
      name: (m.full_name as string | null) ?? null,
      companyRole: (m.role as string | null) ?? null, // org tier — the roster's default sort key
      sessionCount: rows.length,
      firstSessionAt,
      establishingBaseline,
      conversionRate: conversion,
      relianceReduction: reliance,
      quotaAttainment: quota,
      objectionsPerSession: objectionsPerSession(objRows),
      objectionResolutionRate: objectionResolutionRate(objRows),
      recommendationUptake: recommendationUptake(recRows),
      followUpRate: followUpRate(prospectRows),
      salesCycleLength: salesCycleLengthDays(prospectRows),
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
