import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import {
  conversionRate,
  closeRate,
  revenue,
  avgDealSize,
  sessionsPerDay,
  avgSessionDurationMin,
  monthKeyUtc,
  type KpiSessionRow,
  type MetricResult,
} from "@/lib/coach/kpi/compute";

/**
 * GET /api/coach/kpi/compute-cron — scheduled KPI persistence (SalesCoach-KPI-System.md Phase 5).
 *
 * Computes each agent's Layer-1/2 KPIs and PERSISTS them into kpi_snapshot so the manager rollup + digests
 * can read precomputed rows (the agent's own view stays on-read/live). Service-role only (writes bypass the
 * 0205 RLS that blocks member writes). Idempotent: for period='current' it deletes an agent's existing
 * current snapshots for a metric, then inserts the fresh one — re-running converges, never duplicates.
 * Bounded batch with an honest `bounded` flag (never a silent "all done"). DORMANT until CRON_SECRET
 * is set + the cron is scheduled; nothing runs before then.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_AGENTS = 100;
const PERIOD = "current";

const LAYER1: Record<string, (r: KpiSessionRow[]) => MetricResult> = {
  conversionRate,
  closeRate,
  revenue,
  avgDealSize,
};
const LAYER2: Record<string, (r: KpiSessionRow[]) => MetricResult> = {
  sessionsPerDay,
  avgSessionDurationMin,
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set — KPI compute disabled until configured." },
      { status: 503 }
    );
  }
  if (!constantTimeEqual(req.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Two periods per run: 'current' is the live value the manager rollup reads (overwritten each run); the
  // UTC-month key ('YYYY-MM') is the LONGITUDINAL baseline — within a month it converges to the latest value,
  // and once the month rolls over that row is never touched again, freezing an end-of-month snapshot. This is
  // what makes the "vs earlier months" trajectory real instead of only the on-read half-split, AND it obeys
  // Data-as-Asset: without it the daily cron would discard its own history every run. Value = cumulative
  // metric as of that month (same computation as 'current', just tagged) — a later consumer diffs the series.
  const monthKey = monthKeyUtc(new Date());
  const periods = [PERIOD, monthKey];

  // Agents who have at least one session (a bounded batch of distinct agent_ids).
  const { data: agentRows, error } = await admin
    .from("coaching_sessions")
    .select("company_id, agent_id")
    .order("agent_id", { ascending: true })
    .limit(5000);
  if (error) {
    return NextResponse.json({ computed: 0, note: "no coaching_sessions or read error" });
  }
  const agentToCompany = new Map<string, string>();
  for (const r of agentRows ?? []) agentToCompany.set(r.agent_id as string, r.company_id as string);
  const agents = [...agentToCompany.keys()].slice(0, BATCH_AGENTS);

  // Batch the whole batch's sessions in ONE read, grouped by agent in memory — avoids an N+1 (a
  // separate coaching_sessions query per agent), mirroring how the /team rollup reads its team. The
  // global started_at order is preserved within each agent's subgroup (the metric fns assume ascending).
  const { data: allSessRows } = await admin
    .from("coaching_sessions")
    .select("id, agent_id, outcome, deal_value, started_at, ended_at")
    .in("agent_id", agents)
    .order("started_at", { ascending: true });
  const rowsByAgent = new Map<string, KpiSessionRow[]>();
  for (const s of allSessRows ?? []) {
    const aid = s.agent_id as string;
    const list = rowsByAgent.get(aid) ?? [];
    list.push({
      sessionId: s.id as string,
      outcome: (s.outcome as KpiSessionRow["outcome"]) ?? null,
      dealValue: s.deal_value === null || s.deal_value === undefined ? null : Number(s.deal_value),
      startedAt: s.started_at as string,
      endedAt: (s.ended_at as string | null) ?? null,
    });
    rowsByAgent.set(aid, list);
  }

  let computed = 0;
  let snapshots = 0;
  let snapshotErrors = 0;
  for (const agentId of agents) {
    const companyId = agentToCompany.get(agentId) as string;
    const rows = rowsByAgent.get(agentId) ?? [];

    const toWrite: { metric: string; layer: number; res: MetricResult }[] = [];
    for (const [metric, fn] of Object.entries(LAYER1)) toWrite.push({ metric, layer: 1, res: fn(rows) });
    for (const [metric, fn] of Object.entries(LAYER2)) toWrite.push({ metric, layer: 2, res: fn(rows) });

    for (const w of toWrite) {
      for (const period of periods) {
        // Idempotent per (agent, metric, period): clear then insert the fresh one (even a gated value:null,
        // so "building" is a real recorded state, not a stale old value). For 'current' this overwrites each
        // run; for the month key it converges within the month, then freezes when the month rolls over.
        await admin
          .from("kpi_snapshot")
          .delete()
          .eq("agent_id", agentId)
          .eq("metric", w.metric)
          .eq("period", period);
        const { error: insErr } = await admin.from("kpi_snapshot").insert({
          company_id: companyId,
          agent_id: agentId,
          metric: w.metric,
          layer: w.layer,
          value: w.res.value,
          period,
          sample_size: w.res.sampleSize,
          source_session_ids: w.res.sourceSessionIds,
        });
        // The delete above already ran, so a failed insert leaves this (agent, metric, period) with NO
        // snapshot until the next run re-computes it. That gap is self-healing, but it must NOT be invisible:
        // a metrics cron that silently drops a KPI is the honesty-thesis failure (§3.4) — and a PERSISTENT
        // insert failure (bad value, constraint) would otherwise produce zero snapshots with no signal at all.
        // Surfaced + counted, mirroring the sibling crons (retention's storageErrors, purge's assetErrors).
        if (!insErr) {
          snapshots += 1;
        } else {
          snapshotErrors += 1;
          console.error(
            `[coach/kpi/compute-cron] snapshot insert failed for agent=${agentId} metric=${w.metric} period=${period}:`,
            insErr
          );
        }
      }
    }
    computed += 1;
  }

  return NextResponse.json({
    computed,
    snapshots,
    snapshotErrors, // non-zero = some KPI snapshots were dropped this run (self-heals next run); never silent
    scannedAgents: agentToCompany.size,
    bounded: agentToCompany.size > BATCH_AGENTS, // true = more agents remain than this run covered
  });
}
