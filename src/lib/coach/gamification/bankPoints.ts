import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScoreCategory } from "@/lib/coach/v5/summaryTypes";
import { computeSessionPoints } from "./points";
import { RUBRIC_VERSION, STRONG_SESSION_THRESHOLD } from "./rubric";

/**
 * Gamification Phase 2 — the orchestrator (the ONLY function here with a DB side effect). It does NOT score: the
 * after-pitch summary already did (DECISION: reuse). It READS that session's existing dimension scores, maps them
 * to points (computeSessionPoints — pure), and banks ONE 'session_score' row in the append-only ledger.
 *
 * IDEMPOTENT: the Phase-1 unique index (one session_score per session) is the guard. A retried run, a re-score, or
 * a concurrent double-invocation banks at most once — the second hits the unique constraint and is reported as
 * already-banked, never a second row or double points. Service-role (works with or without a user session).
 *
 * HONESTY (3.4): if the after-pitch summary is missing, or has no scored dimension, NOTHING is banked and the
 * reason is returned — never a fabricated 0-point row.
 */
export type BankResult =
  | { banked: true; points: number; band: string; strong: boolean }
  | { banked: false; reason: "no_after_pitch" | "not_scoreable" | "already_banked" };

export async function bankSessionPoints(sessionId: string): Promise<BankResult> {
  const admin = createAdminClient();

  // The after-pitch summary IS the score source (rep-private; read via service role). Latest wins.
  const { data: ap } = await admin
    .from("after_pitch_summaries")
    .select("company_id, agent_id, payload")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ap) return { banked: false, reason: "no_after_pitch" };

  const scores = ((ap.payload as { scores?: ScoreCategory[] } | null)?.scores ?? []) as ScoreCategory[];
  const computed = computeSessionPoints(scores);
  if (!computed) return { banked: false, reason: "not_scoreable" };

  const { error } = await admin.from("agent_point_ledger").insert({
    company_id: ap.company_id as string,
    agent_id: ap.agent_id as string,
    session_id: sessionId,
    points: computed.points,
    reason: "session_score",
    detail: { rubric_version: RUBRIC_VERSION, band: computed.band, dimensions: computed.dimensions },
    // created_by omitted → null (system-banked).
  });

  if (error) {
    // 23505 = unique_violation on agent_point_ledger_session_score_uniq → already banked (idempotent, not a bug).
    if ((error as { code?: string }).code === "23505") return { banked: false, reason: "already_banked" };
    throw error; // a real error surfaces — never silently swallow (recurring-failure discipline)
  }

  // `strong` = crossed the manager-alert line (Phase 4 fans out the notification; Phase 2 just reports it).
  return {
    banked: true,
    points: computed.points,
    band: computed.band,
    strong: computed.points >= STRONG_SESSION_THRESHOLD,
  };
}

// RECOVERY (founder decision 2026-09-03): there is no in-code re-runnable backfill fn here. The live path banks
// inline (above) on every after-pitch and THROWS on a real error (never a silent skip), so a bank failure is
// visible in logs. To (re)populate the board — the one-time seed, or recovery for any session whose inline bank
// failed transiently — re-run `node scripts/seed-gamification-points.mjs --apply` (idempotent: it skips sessions
// that already have a session_score row and catches the unique violation). A prior unwired `backfillSessionPoints`
// export was removed as dead code; the script is the single backfill path (drift-guarded by seedScriptDrift.test).
