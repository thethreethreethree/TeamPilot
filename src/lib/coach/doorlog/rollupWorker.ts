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

/** Refresh ONE period's summary for a rep. `todayIso` is the rep's LOCAL today (see rollupRep), so the
 *  window matches the device-tz KPI surface. */
async function rollupPeriod(args: {
  companyId: string;
  repId: string;
  period: Period;
  todayIso: string;
}): Promise<void> {
  const sb = createAdminClient();
  const startIso = periodStart(args.period, args.todayIso);
  // F5: window on the knock's device-tz `local_date` (the SAME field the KPI strip counts), NOT the pitch's
  // UTC `recorded_at`. An evening pitch in a behind-UTC tz has a recorded_at that rolls into the next UTC day,
  // so a UTC window put it in a different day/week than the KPI showed. local_date is a DATE (no time-of-day),
  // compared date-to-date. Both queries embed door_knocks!inner so the join carries the filter.
  const sinceDate = args.period === "all_time" ? undefined : startIso;

  // The period's completed pitches (windowed by the knock's local_date) + analyses.
  let pitchQ = sb
    .from("pitches")
    .select("id, recorded_at, door_knocks!inner(local_date, outcome), pitch_analyses!inner(summary, strengths, improvements, scores)")
    .eq("rep_id", args.repId)
    .eq("status", "complete");
  if (sinceDate) pitchQ = pitchQ.gte("door_knocks.local_date", sinceDate);
  // F2: order so the LLM SAMPLE is the most-recent (deterministic + coaching-relevant), not an arbitrary
  // PostgREST slice. The sample is still capped (an LLM can't ingest thousands of pitches) — but the
  // DISPLAYED pitch_count is the REAL total (counted separately below), never the capped sample length.
  const { data: rows } = await pitchQ.order("recorded_at", { ascending: false }).limit(500);
  const pitches = rows ?? [];
  if (pitches.length === 0) return; // nothing to summarise this period

  // Real total pitch count for the period (head+exact — embeds door_knocks!inner so the SAME local_date
  // window applies; not truncated by the sample cap).
  let countQ = sb
    .from("pitches")
    .select("id, door_knocks!inner(local_date)", { count: "exact", head: true })
    .eq("rep_id", args.repId)
    .eq("status", "complete");
  if (sinceDate) countQ = countQ.gte("door_knocks.local_date", sinceDate);
  const { count: realPitchCount } = await countQ;

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
    pitchCount: realPitchCount ?? pitches.length, // REAL total (F2), not the capped sample length
    model: "brain",
    promptVersion: ROLLUP_PROMPT_VERSION,
  });
}

/** Refresh all four period summaries for one rep. Errors per-period are swallowed (retried next sweep). */
export async function rollupRep(args: { companyId: string; repId: string; todayIso: string }): Promise<void> {
  const sb = createAdminClient();
  // F5: the rep's LOCAL "today" = their most recent knock's local_date (device-tz, already captured), so the
  // period windows anchor to the rep's own sales day — matching the KPI strip — WITHOUT storing per-rep tz.
  // The cron's UTC `todayIso` is only the fallback for a rep with no knocks yet (no window to compute anyway).
  const { data: latest } = await sb
    .from("door_knocks")
    .select("local_date")
    .eq("rep_id", args.repId)
    .order("local_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const repTodayIso = (latest?.local_date as string | undefined) ?? args.todayIso;
  for (const period of ["day", "week", "month", "all_time"] as Period[]) {
    try {
      await rollupPeriod({ companyId: args.companyId, repId: args.repId, period, todayIso: repTodayIso });
    } catch {
      /* one period failing must not block the others; the cron re-runs */
    }
  }
}

/**
 * A rep is DUE for a rollup iff they have no summary yet, or their latest completed pitch is newer than their
 * newest summary. Pure so the cost gate (skip a re-run when nothing changed) is unit-tested and can't regress
 * back to the every-minute LLM re-run. ISO timestamps compare correctly as strings.
 */
export function isRepDueForRollup(latestPitchIso: string, latestSummaryIso: string | undefined): boolean {
  return !latestSummaryIso || latestSummaryIso < latestPitchIso;
}

/** Find reps with a recently-completed pitch and refresh their rollups (the cron's rollup pass). */
export async function rollupDueReps(todayIso: string, limit = 20): Promise<number> {
  const sb = createAdminClient();
  // Candidate reps: any complete pitch in the last day (bounded), tracking each rep's LATEST completion.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await sb
    .from("pitches")
    .select("rep_id, company_id, updated_at")
    .eq("status", "complete")
    .gte("updated_at", since)
    .limit(500);
  const candidates = new Map<string, { companyId: string; latestPitch: string }>();
  for (const r of data ?? []) {
    const repId = r.rep_id as string;
    const ts = r.updated_at as string;
    const prev = candidates.get(repId);
    if (!prev || ts > prev.latestPitch) candidates.set(repId, { companyId: r.company_id as string, latestPitch: ts });
  }
  if (candidates.size === 0) return 0;

  // Cost gate (the "ideal" the v1 comment named): only roll up a rep whose latest completed pitch is NEWER than
  // their newest summary. The cron fires every minute; without this, every rep active in the last 24h re-ran the
  // rollup engine (4 LLM calls — day/week/month/all_time) EVERY minute even with no new pitch — pure spend on an
  // unchanged summary. A rep with no summary yet has no row here, so they always roll up (first time).
  const { data: sums } = await sb
    .from("rep_pattern_summaries")
    .select("rep_id, generated_at")
    .in("rep_id", [...candidates.keys()]);
  const latestSummary = new Map<string, string>();
  for (const s of sums ?? []) {
    const repId = s.rep_id as string;
    const ts = s.generated_at as string;
    const prev = latestSummary.get(repId);
    if (!prev || ts > prev) latestSummary.set(repId, ts);
  }

  let n = 0;
  for (const [repId, { companyId, latestPitch }] of candidates) {
    if (n >= limit) break;
    if (!isRepDueForRollup(latestPitch, latestSummary.get(repId))) continue; // summary current — skip LLM re-run
    await rollupRep({ companyId, repId, todayIso });
    n += 1;
  }
  return n;
}
