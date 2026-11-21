import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { computeInteractionStats, timedSegments, type InteractionStats, type Segment } from "./stats";

/**
 * Interaction stats for one remote sales session — computed from its CURRENT transcript and stored per
 * transcript version in session_interaction_stats (migration 0277; RSS Phase 2, Gong F10.1-F10.6).
 *
 * `loadSessionTiming` is the ONE read both the pipeline (store) and the session page (lanes + live numbers) use,
 * so the page and the stored row can never disagree about one transcript (§2.2). It reads the transcript view
 * with select("*") so it works before 0277 too (no ended_at → every end estimated, and labelled so).
 */
export type SessionTiming = {
  sessionId: string;
  companyId: string;
  repId: string;
  transcriptVersion: number;
  segments: Segment[];
  estimated: boolean;
  untimed: number;
};

export async function loadSessionTiming(db: SupabaseClient, sessionId: string): Promise<SessionTiming | null> {
  const { data: s } = await db
    .from("coaching_sessions")
    .select("id, company_id, agent_id, context, session_kind, started_at, audio_duration_seconds")
    .eq("id", sessionId)
    .maybeSingle();
  if (!s || !isRemoteContext(s.context) || !isSalesCall((s.session_kind as string | null) ?? "sales")) return null;

  const { data: rows, error } = await db
    .from("coaching_transcript_segments_current")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (error) {
    console.error(`[interactionStats] transcript read failed session=${sessionId}: ${error.message}`);
    return null;
  }
  const list = (rows ?? []) as Array<{ speaker: string; text: string; spoken_at?: string | null; ended_at?: string | null; version?: number }>;
  const t = timedSegments(list, (s.started_at as string | null) ?? null, (s.audio_duration_seconds as number | null) ?? null);
  return {
    sessionId,
    companyId: String(s.company_id),
    repId: String(s.agent_id),
    transcriptVersion: Math.max(1, Number(list[0]?.version) || 1),
    ...t,
  };
}

/** Compute and store. Never throws; returns the stats written (or already there), or null. */
export async function storeInteractionStats(sessionId: string, client?: SupabaseClient): Promise<InteractionStats | null> {
  try {
    const admin = client ?? createAdminClient();
    const timing = await loadSessionTiming(admin, sessionId);
    if (!timing || timing.segments.length === 0) return null;
    const stats = computeInteractionStats(timing.segments);
    // A plain insert: Postgres refuses ON CONFLICT (even DO NOTHING) on a table with an UPDATE rule (0277:162).
    // 23505 means this transcript version is already stored, which is the once-per-version guarantee working.
    const { error } = await admin.from("session_interaction_stats").insert(
      {
        session_id: sessionId,
        company_id: timing.companyId,
        rep_id: timing.repId,
        transcript_version: timing.transcriptVersion,
        estimated: timing.estimated,
        talk_ratio_time: stats.talkRatioTime,
        longest_rep_monologue_ms: Math.round(stats.longestRepMonologueMs),
        longest_customer_story_ms: Math.round(stats.longestCustomerStoryMs),
        interactivity: stats.interactivity,
        patience_ms: stats.patienceMs === null ? null : Math.round(stats.patienceMs),
        rep_questions_per_hour: stats.repQuestionsPerHour,
      }
    );
    if (error && error.code !== "23505") console.error(`[interactionStats] store failed session=${sessionId}: ${error.message}`);
    return stats;
  } catch (err) {
    console.error(`[interactionStats] threw session=${sessionId}:`, err);
    return null;
  }
}
