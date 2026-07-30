import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import {
  conversionRate,
  closeRate,
  revenue,
  avgDealSize,
  quotaAttainment,
  winLossRatio,
  layer3InputFromPayload,
  monthKeyUtc,
  sessionsPerDay,
  avgSessionDurationMin,
  layer3Dimension,
  layer3Delta,
  overallSkillProgression,
  qualityConsistency,
  cueAcceptanceRate,
  cueToOutcomeCorrelation,
  relianceReductionFromFirstCue,
  selfDelta,
  MIN_SESSIONS,
  type KpiSessionRow,
  type MetricResult,
  type Layer3ScoreInput,
} from "@/lib/coach/kpi/compute";

// The after-pitch score dimensions that become Layer-3 quality KPIs (real evidenced scores).
const LAYER3_KEYS = ["opener", "objection", "tone", "close", "question_rate", "next_step"] as const;

/**
 * GET /api/coach/kpi/me — the caller's OWN KPI snapshot, computed on-read (founder: on-read + cron).
 *
 * Computes live from the caller's coaching_sessions (RLS-scoped to their own rows). No DB write on read —
 * always fresh, can't sit dormant. The cron path persists snapshots for team rollup + digests. Every metric
 * carries the Understanding Gate ("building" until MIN_SESSIONS) + its sourceSessionIds for drill-down, so
 * nothing here asserts a number it can't trace to real sessions.
 */
export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // The caller's own sessions (agent_id = self). RLS also permits same-company reads, so pin to self.
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("id, outcome, deal_value, started_at, ended_at, client_label")
    .eq("agent_id", ctx.userId)
    .order("started_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Couldn't load your sessions." }, { status: 500 });
  }

  const rows: KpiSessionRow[] = (data ?? []).map((r) => ({
    sessionId: r.id as string,
    outcome: (r.outcome as KpiSessionRow["outcome"]) ?? null,
    dealValue:
      r.deal_value === null || r.deal_value === undefined ? null : Number(r.deal_value),
    startedAt: r.started_at as string,
    endedAt: (r.ended_at as string | null) ?? null,
  }));

  const metrics: Record<string, MetricResult> = {
    conversionRate: conversionRate(rows),
    closeRate: closeRate(rows),
    winLossRatio: winLossRatio(rows),
    revenue: revenue(rows),
    avgDealSize: avgDealSize(rows),
    sessionsPerDay: sessionsPerDay(rows),
    avgSessionDurationMin: avgSessionDurationMin(rows),
  };

  // Quota attainment (founder: monthly deals-won target). Fetch the company target (A34-guarded: a missing
  // column pre-0206, or any read error, leaves the target null → the metric reads "building", never a guess).
  let monthlyTarget: number | null = null;
  {
    const { data: co, error: coErr } = await sb
      .from("companies")
      .select("sales_coach_monthly_deal_target")
      .eq("id", ctx.companyId)
      .maybeSingle();
    if (!coErr) monthlyTarget = (co?.sales_coach_monthly_deal_target as number | null) ?? null;
  }
  const monthPrefix = monthKeyUtc(new Date());
  const dealsWonThisMonth = rows.filter(
    (r) => r.outcome === "sold" && r.startedAt.slice(0, 7) === monthPrefix
  ).length;
  metrics.quotaAttainment = quotaAttainment(dealsWonThisMonth, monthlyTarget);

  // Self-comparison deltas (recent half − prior half) for the session-based metrics — spec principle #1.
  const deltas: Record<string, number | null> = {
    conversionRate: selfDelta(rows, conversionRate),
    closeRate: selfDelta(rows, closeRate),
    avgDealSize: selfDelta(rows, avgDealSize),
    sessionsPerDay: selfDelta(rows, sessionsPerDay),
    avgSessionDurationMin: selfDelta(rows, avgSessionDurationMin),
  };

  // Layer 3 — reuse the after-pitch evidenced scores (no new scoring). payload.scores is a ScoreCategory[].
  const { data: apRows } = await sb
    .from("after_pitch_summaries")
    .select("session_id, payload")
    .eq("agent_id", ctx.userId);

  const layer3Rows: Layer3ScoreInput[] = (apRows ?? []).map((r) =>
    layer3InputFromPayload(r.session_id as string, r.payload)
  );
  for (const k of LAYER3_KEYS) metrics[`l3_${k}`] = layer3Dimension(layer3Rows, k);
  // Talk share (Layer 2) — the after-pitch already scores talk_ratio (rep's share of the talking, 0-100
  // after scaling; lower leaves more room to listen). Reuse the same evidenced-score aggregator.
  metrics.l2_talk_ratio = layer3Dimension(layer3Rows, "talk_ratio");
  // Skill progression (Layer 4) — Δ in overall quality vs the agent's own earlier calls (value IS the delta).
  metrics.skillProgression = overallSkillProgression(layer3Rows);
  // Consistency (Layer 4) — how steady the agent's quality is call-to-call (0-100, higher = steadier).
  metrics.consistency = qualityConsistency(layer3Rows);
  // Self-comparison deltas for the quality dimensions too (spec: EACH shown against its own trajectory).
  for (const k of LAYER3_KEYS) deltas[`l3_${k}`] = layer3Delta(layer3Rows, k);
  deltas.l2_talk_ratio = layer3Delta(layer3Rows, "talk_ratio");

  // Layer 4 — cues + outcomes (from the agent's sessions). Reliance Reduction is the headline.
  const sessionIds = rows.map((r) => r.sessionId);
  if (sessionIds.length > 0) {
    const [{ data: cueRows }, { data: outcomeRows }, { data: segRows }] = await Promise.all([
      sb.from("coaching_cues").select("id, session_id").in("session_id", sessionIds),
      sb.from("coaching_cue_outcomes").select("cue_id, determination").in("session_id", sessionIds),
      sb.from("coaching_transcript_segments").select("session_id").in("session_id", sessionIds),
    ]);
    // "Coach ran this session" = it produced ≥1 transcript segment. A session with no segments is a
    // no-coaching call (rep didn't use the live coach) — its 0 cues are not a reliance signal, so exclude it.
    const coachedSessions = new Set((segRows ?? []).map((s) => s.session_id as string));
    const actedCueIds = new Set(
      (outcomeRows ?? [])
        .filter((o) => o.determination === "followed" || o.determination === "partial")
        .map((o) => o.cue_id as string)
    );
    const cues = (cueRows ?? []).map((c) => ({ acted: actedCueIds.has(c.id as string) }));
    metrics.cueAcceptanceRate = cueAcceptanceRate(cues);

    // Reliance reduction: per-session cue count, ordered by the agent's session timeline (rows are asc).
    const countBySession = new Map<string, number>();
    for (const c of cueRows ?? []) {
      const sid = c.session_id as string;
      countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
    }
    const points = rows
      .filter((r) => coachedSessions.has(r.sessionId)) // coach-active sessions only
      .map((r) => ({ cueCount: countBySession.get(r.sessionId) ?? 0, sessionId: r.sessionId }));
    metrics.relianceReduction = relianceReductionFromFirstCue(points);

    // Cue-to-outcome correlation (spec #2) — per session with cues AND a win/loss outcome.
    const actedBySession = new Map<string, number>();
    for (const c of cueRows ?? []) {
      if (actedCueIds.has(c.id as string)) {
        const sid = c.session_id as string;
        actedBySession.set(sid, (actedBySession.get(sid) ?? 0) + 1);
      }
    }
    const corrRows = rows
      .filter((r) => (countBySession.get(r.sessionId) ?? 0) > 0 && (r.outcome === "sold" || r.outcome === "no_sale"))
      .map((r) => ({
        actedRate: (actedBySession.get(r.sessionId) ?? 0) / (countBySession.get(r.sessionId) as number),
        won: r.outcome === "sold",
        sessionId: r.sessionId,
      }));
    metrics.cueToOutcome = cueToOutcomeCorrelation(corrRows);
  } else {
    metrics.cueAcceptanceRate = cueAcceptanceRate([]);
    metrics.relianceReduction = relianceReductionFromFirstCue([]);
    metrics.cueToOutcome = cueToOutcomeCorrelation([]);
  }

  // Compact session lookup for drill-down (every KPI traces to the sessions that produced it).
  const sessions: Record<string, { label: string | null; startedAt: string; outcome: string | null }> = {};
  for (const r of data ?? []) {
    sessions[r.id as string] = {
      label: (r.client_label as string | null) ?? null,
      startedAt: r.started_at as string,
      outcome: (r.outcome as string | null) ?? null,
    };
  }

  return NextResponse.json({
    sessionCount: rows.length,
    minSessions: MIN_SESSIONS,
    metrics,
    deltas,
    sessions,
  });
}
