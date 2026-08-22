import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import type { KnockOutcome } from "@/lib/coach/doorlog/outcomes";
import type { PatternRollupResult } from "@/lib/coach/doorlog/analysisSchema";
import { periodStartLocal, averageScores, type MetricsPeriod } from "@/lib/coach/doorlog/period";

/**
 * Door Log / Report Card data layer (Macro Mode). Per AMD-006 L1 — every CRUD function lives here so
 * routes/worker stay thin and the schema mapping is one file to audit.
 *
 * TWO clients by design (Q4 = rep + manager RLS):
 *  - REP-facing reads/writes go through the RLS user client (`createClient`) — a rep sees/writes only
 *    their own rows; a manager sees the team; RLS enforces it.
 *  - The background WORKER uses the service-role client (`createAdminClient`, bypasses RLS) and is the
 *    ONLY writer to pitch_transcripts / pitch_analyses / rep_pattern_summaries (build spec 3.2).
 */

// ─── Rep-facing (RLS client) ─────────────────────────────────────────────────

/** Log a knock. Idempotent on client_knock_id (offline queue may retry). Returns the knock id — INCLUDING
 *  on a dedupe (F1 fix): a dependent pitch write must still be able to attach to the existing knock, so we
 *  fetch the existing id rather than dropping it. `deduped` is informational. */
export async function createKnock(args: {
  companyId: string;
  outcome: KnockOutcome;
  localDate: string;
  clientKnockId?: string | null;
}): Promise<{ id: string; deduped?: boolean } | null> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await sb
    .from("door_knocks")
    .upsert(
      {
        company_id: args.companyId,
        rep_id: auth.user.id,
        outcome: args.outcome,
        local_date: args.localDate,
        client_knock_id: args.clientKnockId ?? null,
      },
      { onConflict: "rep_id,client_knock_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (error) return null;
  if (data) return { id: data.id as string };
  // Deduped (ignoreDuplicates → null) OR a no-return insert: fetch the existing knock's id so the pitch
  // path can still attach to it. Without this, a knock-yes/pitch-no partial failure was unrepairable (F1).
  if (args.clientKnockId) {
    const { data: existing } = await sb
      .from("door_knocks")
      .select("id")
      .eq("rep_id", auth.user.id)
      .eq("client_knock_id", args.clientKnockId)
      .maybeSingle();
    if (existing) return { id: existing.id as string, deduped: true };
  }
  return null;
}

/** Create the pitch row for a knock (status starts 'recorded'; the worker advances it). */
export async function createPitch(args: {
  knockId: string;
  companyId: string;
  name: string;
  audioPath: string | null;
  durationMs: number | null;
}): Promise<{ id: string } | null> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await sb
    .from("pitches")
    .insert({
      knock_id: args.knockId,
      company_id: args.companyId,
      rep_id: auth.user.id,
      name: args.name,
      audio_path: args.audioPath,
      duration_ms: args.durationMs,
      status: args.audioPath ? "uploading" : "recorded",
    })
    .select("id")
    .maybeSingle();
  if (data) return { id: data.id as string };
  // The unique index on knock_id makes this idempotent (F1): a retry that hits the existing pitch is a
  // SUCCESS — return the existing id, never lose the pitch.
  if (error) {
    const { data: existing } = await sb
      .from("pitches")
      .select("id")
      .eq("knock_id", args.knockId)
      .maybeSingle();
    if (existing) return { id: existing.id as string };
  }
  return null;
}

/** The rep's KPI strip for a local day (RLS-scoped; a manager may pass a rep's id via the view's RLS). */
export async function getKpiForDay(localDate: string, repId: string) {
  const sb = await createClient();
  // Scope to the CALLER's own row. rep_kpi_daily is rep+manager RLS, so for a MANAGER an unscoped read returns
  // the whole team's rows and the caller would sum them — but the Door Log KPI strip is the acting rep's OWN
  // field session, so pin rep_id. (A rep's unscoped read already returned only theirs; this makes managers
  // correct too. Mirrors the F6 report-card rep scoping.)
  const { data } = await sb
    .from("rep_kpi_daily")
    .select("doors_knocked, sold, go_backs, not_interested, no_answer, non_decision_maker, local_date")
    .eq("local_date", localDate)
    .eq("rep_id", repId);
  return data ?? [];
}

/**
 * All-time Macro Mode totals for a rep (the dashboard's Doors Knocked / Presentation / Sold bubbles).
 * Paged (fetchAllPaged) so a rep with >1000 active days can't silently undercount — summing a PostgREST
 * read truncated at 1000 rows is the honesty-thesis wrong-number class. A "presentation" = a door where the
 * rep actually pitched, i.e. any outcome other than No-Answer (doors_knocked − no_answer).
 */
export async function getAllTimeKpi(
  repId: string,
): Promise<{ doorsKnocked: number; presentations: number; sold: number }> {
  const sb = await createClient();
  const rows = await fetchAllPaged<{ doors_knocked: number; sold: number; no_answer: number }>(
    (from, to) =>
      sb
        .from("rep_kpi_daily")
        .select("doors_knocked, sold, no_answer")
        .eq("rep_id", repId)
        .range(from, to),
    { label: "all-time door KPI" },
  );
  let doorsKnocked = 0;
  let sold = 0;
  let noAnswer = 0;
  for (const r of rows) {
    doorsKnocked += Number(r.doors_knocked ?? 0);
    sold += Number(r.sold ?? 0);
    noAnswer += Number(r.no_answer ?? 0);
  }
  return { doorsKnocked, presentations: Math.max(0, doorsKnocked - noAnswer), sold };
}

/**
 * Today's Metrics for a rep + period (Macro Mode, founder spec 2026-08-19): the KPI trio (doors / conversations
 * = presentations / sales), the Score-Chart averages across the period's analyzed pitches, and the Next-Door
 * focus + growth opportunities from the macro rollup. RLS-scoped (the caller sees their own; a manager may pass
 * a team member's repId, still RLS-authorized). Windows match the rollup (via the rep's device-tz local_date).
 */
export async function getTodaysMetrics(
  repId: string,
  period: MetricsPeriod,
): Promise<{
  kpi: { doorsKnocked: number; conversations: number; sold: number };
  scores: Record<string, number>;
  focus: string | null;
  opportunities: string[];
}> {
  const sb = await createClient();

  // The rep's local "today" = their latest knock's local_date (device-tz, already captured), UTC-today fallback.
  const { data: latest } = await sb
    .from("door_knocks")
    .select("local_date")
    .eq("rep_id", repId)
    .order("local_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const todayIso = (latest?.local_date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const since = periodStartLocal(period, todayIso);

  // KPIs, scores, and the rollup summary are independent (all key on the window resolved above) — run them in
  // PARALLEL so the rep waits on the slowest, not the sum. KPIs + scores are PAGED so a heavy rep's rows can't
  // silently truncate the sum/average (honesty thesis); the summary is the precomputed rollup (no LLM on view).
  const [kpiRows, pitchRows, summaryRes] = await Promise.all([
    fetchAllPaged<{ doors_knocked: number; sold: number; no_answer: number }>(
      (from, to) => {
        const base = sb.from("rep_kpi_daily").select("doors_knocked, sold, no_answer").eq("rep_id", repId);
        return (since ? base.gte("local_date", since) : base).range(from, to);
      },
      { label: "todays-metrics kpi" },
    ),
    fetchAllPaged<{
      pitch_analyses: { scores: Record<string, number> } | { scores: Record<string, number> }[];
    }>(
      (from, to) => {
        const base = sb
          .from("pitches")
          .select("pitch_analyses!inner(scores), door_knocks!inner(local_date)")
          .eq("rep_id", repId)
          .eq("status", "complete");
        return (since ? base.gte("door_knocks.local_date", since) : base).range(from, to);
      },
      { label: "todays-metrics scores" },
    ),
    sb
      .from("rep_pattern_summaries")
      .select("patterns_bad")
      .eq("period", period)
      .eq("rep_id", repId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let doorsKnocked = 0;
  let sold = 0;
  let noAnswer = 0;
  for (const r of kpiRows) {
    doorsKnocked += Number(r.doors_knocked ?? 0);
    sold += Number(r.sold ?? 0);
    noAnswer += Number(r.no_answer ?? 0);
  }

  const scoresList: Array<Record<string, number>> = [];
  for (const p of pitchRows) {
    const a = p.pitch_analyses;
    const scores = Array.isArray(a) ? a[0]?.scores : a?.scores;
    if (scores) scoresList.push(scores);
  }

  const opportunities = (summaryRes.data?.patterns_bad as string[] | undefined) ?? [];

  return {
    kpi: { doorsKnocked, conversations: Math.max(0, doorsKnocked - noAnswer), sold },
    scores: averageScores(scoresList),
    // Next-Door focus = the rep's #1 recurring growth opportunity, surfaced automatically (founder decision).
    focus: opportunities[0] ?? null,
    opportunities,
  };
}

// ─── Worker-facing (service-role; the ONLY writer to the derived tables) ──────

/** Claim the next processable pitch (status/run_after sweep) — mirrors the backfill-dissects-cron pattern.
 *  NOTE: this is only the CANDIDATE list; `claimPitchForProcessing` below is the atomic per-pitch gate. */
export async function claimPitchesToProcess(limit = 10) {
  const sb = createAdminClient();
  const { data } = await sb
    .from("pitches")
    .select("id, company_id, rep_id, audio_path, status, attempts")
    .in("status", ["uploading", "recorded", "transcribing", "analyzing"])
    .lte("run_after", new Date().toISOString())
    .order("run_after", { ascending: true })
    .limit(limit);
  return data ?? [];
}

/**
 * Atomically LEASE one pitch for processing. A pitch is processed from TWO independent entry points — the
 * fire-and-forget kick in the door-log route (`after()`) and the every-minute cron sweep — and both read
 * "no transcript yet" before either writes, so without a claim BOTH run the PAID ElevenLabs STT + the LLM
 * analysis on the same pitch (audit 2026-08-19). This bumps `run_after` into the future CONDITIONED on the
 * pitch being currently due; Postgres row-locking serialises the two writers, so the loser's WHERE re-evaluates
 * against the leased row and matches 0 rows. Returns true iff THIS caller won the lease (and may do the paid
 * work); the loser returns early. The winner's own status writes (complete/failed/backoff) supersede the lease.
 */
export async function claimPitchForProcessing(
  pitchId: string,
  currentAttempts: number,
  leaseMs = 5 * 60_000,
): Promise<{ won: boolean; attempts: number }> {
  const sb = createAdminClient();
  // Advance `attempts` as part of the SAME conditional lease — so EVERY processing attempt consumes an attempt,
  // INCLUDING a serverless timeout / OOM / hard-kill that never reaches the worker's catch (audit H2,
  // 2026-08-22). Previously `attempts` only advanced inside the catch, so a crash left it unchanged and the cron
  // re-claimed the same pitch every 5 min FOREVER ("processing…" that never resolves). Postgres row-locks the
  // update; the loser's WHERE re-evaluates against the leased row and matches 0 rows, so exactly one caller wins
  // and increments. A win means the row was still due (run_after <= now) at lease time, so `currentAttempts`
  // (read moments earlier in the candidate sweep) is the row's live value and `currentAttempts + 1` is correct.
  const nextAttempts = currentAttempts + 1;
  const { data } = await sb
    .from("pitches")
    .update({ run_after: new Date(Date.now() + leaseMs).toISOString(), attempts: nextAttempts })
    .eq("id", pitchId)
    .lte("run_after", new Date().toISOString())
    .in("status", ["uploading", "recorded", "transcribing", "analyzing"])
    .select("attempts");
  const won = (data?.length ?? 0) > 0;
  return { won, attempts: won ? ((data![0]!.attempts as number) ?? nextAttempts) : currentAttempts };
}

export async function writePitchTranscript(args: {
  pitchId: string;
  companyId: string;
  repId: string;
  text: string;
  wordCount: number;
}): Promise<void> {
  const sb = createAdminClient();
  await sb.from("pitch_transcripts").upsert({
    pitch_id: args.pitchId,
    company_id: args.companyId,
    rep_id: args.repId,
    text: args.text,
    word_count: args.wordCount,
    provider: "elevenlabs",
  });
}

export async function writePitchAnalysis(args: {
  pitchId: string;
  companyId: string;
  repId: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  scores: Record<string, number>;
  model: string;
  promptVersion: string;
}): Promise<void> {
  const sb = createAdminClient();
  await sb.from("pitch_analyses").upsert({
    pitch_id: args.pitchId,
    company_id: args.companyId,
    rep_id: args.repId,
    summary: args.summary,
    strengths: args.strengths,
    improvements: args.improvements,
    scores: args.scores,
    model: args.model,
    prompt_version: args.promptVersion,
  });
}

/** Advance / fail a pitch (the worker's status machine; retry bookkeeping in retryBackoff.ts). */
export async function setPitchStatus(args: {
  pitchId: string;
  status: "uploading" | "transcribing" | "analyzing" | "complete" | "failed";
  runAfter?: Date;
  attempts?: number;
  error?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("pitches")
    .update({
      status: args.status,
      run_after: args.runAfter?.toISOString(),
      attempts: args.attempts,
      error: args.error ?? null,
    })
    .eq("id", args.pitchId);
}

/** Upsert a rep's macro pattern summary for a period (the rollup worker's output). */
export async function upsertRepPatternSummary(args: {
  companyId: string;
  repId: string;
  period: "day" | "week" | "month" | "all_time";
  periodStart: string;
  rollup: PatternRollupResult;
  pitchCount: number;
  model: string;
  promptVersion: string;
}): Promise<void> {
  const sb = createAdminClient();
  await sb.from("rep_pattern_summaries").upsert(
    {
      company_id: args.companyId,
      rep_id: args.repId,
      period: args.period,
      period_start: args.periodStart,
      headline: args.rollup.headline,
      patterns_good: args.rollup.patterns_good,
      patterns_bad: args.rollup.patterns_bad,
      trend: args.rollup.trend,
      pitch_count: args.pitchCount,
      model: args.model,
      prompt_version: args.promptVersion,
    },
    { onConflict: "rep_id,period,period_start" }
  );
}
