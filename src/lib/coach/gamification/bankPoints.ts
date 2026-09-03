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

/**
 * Phase 3 backfill: bank points for every session that has an after-pitch summary but no session_score ledger row
 * yet — the D14 seed (populate the board from the already-scored sessions) AND the durable net for any live
 * session whose inline bank failed. Idempotent + re-runnable (bankSessionPoints is; the pre-filter just avoids the
 * needless work). Returns counts. Service-role.
 */
export async function backfillSessionPoints(limit = 2000): Promise<{ scanned: number; banked: number; skipped: number }> {
  const admin = createAdminClient();
  const { data: aps } = await admin.from("after_pitch_summaries").select("session_id").limit(limit);
  const sessionIds = [...new Set((aps ?? []).map((r) => String(r.session_id)))];
  // Which already have a session_score row → skip (avoid re-reading + re-inserting into the immutable ledger).
  const already = new Set<string>();
  for (let i = 0; i < sessionIds.length; i += 200) {
    const slice = sessionIds.slice(i, i + 200);
    const { data: led } = await admin
      .from("agent_point_ledger")
      .select("session_id")
      .eq("reason", "session_score")
      .in("session_id", slice);
    for (const r of led ?? []) already.add(String(r.session_id));
  }
  let banked = 0,
    skipped = 0;
  for (const sid of sessionIds) {
    if (already.has(sid)) {
      skipped++;
      continue;
    }
    const r = await bankSessionPoints(sid);
    if (r.banked) banked++;
    else skipped++;
  }
  return { scanned: sessionIds.length, banked, skipped };
}
