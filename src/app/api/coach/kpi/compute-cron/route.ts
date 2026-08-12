import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";
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

  // Distinct agents with >=1 session. PAGED (was a fixed 5000-row cap → PostgREST returned <=1000, so a company
  // past 1000 sessions had agents whose sessions sort LATE dropped from the batch entirely — and this bites even
  // with far fewer than BATCH_AGENTS agents: heavy per-agent session counts (e.g. 100 agents × 11 sessions =
  // 1100 rows) push the 100th agent past the 1000-row cutoff, so it silently never gets a KPI snapshot. Page by
  // the uuid `id` (stable unique key) to enumerate EVERY distinct agent, then take the first BATCH_AGENTS by a
  // deterministic agent_id sort — same batch semantics as before, minus the truncation. (Durable fix if this
  // grows costly: a `SELECT DISTINCT agent_id` RPC — fetches nothing but the agent list. Tracked for when live.)
  let agentRows;
  try {
    agentRows = await fetchAllPaged<{ company_id: string; agent_id: string }>(
      (from, to) =>
        admin
          .from("coaching_sessions")
          .select("company_id, agent_id")
          .order("id")
          .range(from, to),
      { label: "cron KPI agent enumeration" },
    );
  } catch {
    return NextResponse.json({ computed: 0, note: "no coaching_sessions or read error" });
  }
  const agentToCompany = new Map<string, string>();
  for (const r of agentRows) agentToCompany.set(r.agent_id, r.company_id);
  const agents = [...agentToCompany.keys()].sort().slice(0, BATCH_AGENTS);

  // Batch the whole batch's sessions in ONE read, grouped by agent in memory — avoids an N+1 (a
  // separate coaching_sessions query per agent), mirroring how the /team rollup reads its team. The
  // global started_at order is preserved within each agent's subgroup (the metric fns assume ascending).
  // Paged: this cron aggregates every agent's sessions company-wide — the set crosses the 1000-row
  // cap fastest here, and a truncated read would bake wrong numbers into the persisted KPI history.
  // A34 (audit F4): degrade to wall-clock if audio_duration_seconds (0210) isn't applied yet, rather than
  // aborting the cron with 0 snapshots. Same guard as the team route; the mapper reads `?? null`.
  const loadAllSess = (durCol: string) =>
    fetchAllPaged(
      (from, to) =>
        admin
          .from("coaching_sessions")
          // Cast the dynamic select to the with-column literal so the typed client infers the row shape; the
          // without-column variant omits it at runtime and the mapper reads `?? null` (A34 degrade).
          .select(
            `id, agent_id, outcome, deal_value, started_at, ended_at${durCol}` as "id, agent_id, outcome, deal_value, started_at, ended_at, audio_duration_seconds",
          )
          .in("agent_id", agents)
          .order("started_at", { ascending: true })
          .range(from, to),
      { label: "cron KPI sessions" },
    );
  let allSessRows;
  try {
    allSessRows = await loadAllSess(", audio_duration_seconds");
  } catch (e) {
    if (isMissingColumnError(e as Parameters<typeof isMissingColumnError>[0], "audio_duration_seconds")) {
      allSessRows = await loadAllSess("");
    } else throw e;
  }
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
      audioDurationSeconds: (s.audio_duration_seconds as number | null) ?? null,
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
