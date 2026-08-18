import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import type { KnockOutcome } from "@/lib/coach/doorlog/outcomes";
import type { PatternRollupResult } from "@/lib/coach/doorlog/analysisSchema";

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

// ─── Worker-facing (service-role; the ONLY writer to the derived tables) ──────

/** Claim the next processable pitch (status/run_after sweep) — mirrors the backfill-dissects-cron pattern. */
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
