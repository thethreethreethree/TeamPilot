import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRepPatternRollup, ROLLUP_PROMPT_VERSION, type PitchSignal } from "./rollup";
import { upsertRepPatternSummary } from "@/lib/data/doorlog";

/**
 * Rollup worker (Macro Mode — the Report Card's macro layer). After a rep's pitches are analyzed, refresh
 * their pattern summaries for each period. Service-role (the sole writer to rep_pattern_summaries).
 *
 * A period is a rolling window keyed by a period_start date (a fixed sentinel for all_time). The rollup
 * reads the period's per-pitch analyses + the door_knocks outcome distribution + the PREVIOUS summary's
 * headline (for the trend), then calls the LLM rollup engine and upserts the result.
 */

const ALL_TIME_SENTINEL = "2000-01-01";

type Period = "day" | "week" | "month" | "all_time";

/** period_start (YYYY-MM-DD) for a rolling window ending today. */
function periodStart(period: Period, todayIso: string): string {
  if (period === "all_time") return ALL_TIME_SENTINEL;
  const today = new Date(`${todayIso}T00:00:00Z`);
  const days = period === "day" ? 0 : period === "week" ? 6 : 29;
  today.setUTCDate(today.getUTCDate() - days);
  return today.toISOString().slice(0, 10);
}

/** Refresh ONE period's summary for a rep. */
async function rollupPeriod(args: {
  companyId: string;
  repId: string;
  period: Period;
  todayIso: string;
}): Promise<void> {
  const sb = createAdminClient();
  const startIso = periodStart(args.period, args.todayIso);
  const sinceFilter = args.period === "all_time" ? undefined : `${startIso}T00:00:00Z`;

  // The period's completed pitches (via their recorded_at) + analyses.
  let pitchQ = sb
    .from("pitches")
    .select("id, recorded_at, door_knocks!inner(outcome), pitch_analyses!inner(summary, strengths, improvements, scores)")
    .eq("rep_id", args.repId)
    .eq("status", "complete");
  if (sinceFilter) pitchQ = pitchQ.gte("recorded_at", sinceFilter);
  const { data: rows } = await pitchQ.limit(500);
  const pitches = rows ?? [];
  if (pitches.length === 0) return; // nothing to summarise this period

  const signals: PitchSignal[] = [];
  const outcomeCounts: Record<string, number> = {};
  for (const p of pitches) {
    const knock = p.door_knocks as unknown as { outcome: string } | { outcome: string }[];
    const outcome = (Array.isArray(knock) ? knock[0]?.outcome : knock?.outcome) ?? "unknown";
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
    const a = p.pitch_analyses as unknown as {
      summary: string;
      strengths: string[];
      improvements: string[];
      scores: Record<string, number>;
    };
    if (a) {
      signals.push({
        outcome,
        summary: a.summary,
        strengths: a.strengths ?? [],
        improvements: a.improvements ?? [],
        scores: a.scores ?? {},
      });
    }
  }

  // Previous summary's headline (for the trend), if one exists.
  const { data: prev } = await sb
    .from("rep_pattern_summaries")
    .select("headline")
    .eq("rep_id", args.repId)
    .eq("period", args.period)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rollup = await generateRepPatternRollup({
    companyId: args.companyId,
    pitches: signals,
    outcomeCounts,
    previousHeadline: (prev?.headline as string | undefined) ?? null,
  });
  if (!rollup) return; // suppressed / empty / malformed — leave the prior summary in place, retry next sweep

  await upsertRepPatternSummary({
    companyId: args.companyId,
    repId: args.repId,
    period: args.period,
    periodStart: startIso,
    rollup,
    pitchCount: pitches.length,
    model: "brain",
    promptVersion: ROLLUP_PROMPT_VERSION,
  });
}

/** Refresh all four period summaries for one rep. Errors per-period are swallowed (retried next sweep). */
export async function rollupRep(args: { companyId: string; repId: string; todayIso: string }): Promise<void> {
  for (const period of ["day", "week", "month", "all_time"] as Period[]) {
    try {
      await rollupPeriod({ ...args, period });
    } catch {
      /* one period failing must not block the others; the cron re-runs */
    }
  }
}

/** Find reps with a recently-completed pitch and refresh their rollups (the cron's rollup pass). */
export async function rollupDueReps(todayIso: string, limit = 20): Promise<number> {
  const sb = createAdminClient();
  // Reps whose most recent complete pitch is newer than their newest summary would ideally drive this;
  // for v1, refresh reps with any complete pitch in the last day (bounded).
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await sb
    .from("pitches")
    .select("rep_id, company_id")
    .eq("status", "complete")
    .gte("updated_at", since)
    .limit(500);
  const seen = new Map<string, string>(); // rep_id -> company_id
  for (const r of data ?? []) seen.set(r.rep_id as string, r.company_id as string);
  let n = 0;
  for (const [repId, companyId] of seen) {
    if (n >= limit) break;
    await rollupRep({ companyId, repId, todayIso });
    n += 1;
  }
  return n;
}
