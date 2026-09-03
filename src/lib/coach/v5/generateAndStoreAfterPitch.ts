import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAfterPitchSummary, type AfterPitchSummary } from "@/lib/coach/v5/afterPitch";
import { saveAfterPitchSummary, type SalesContext } from "@/lib/data/salesCoach";
import { bankSessionPoints } from "@/lib/coach/gamification/bankPoints";
import type { ExperienceMode } from "@/lib/experience/mode";

/**
 * generateAndStoreAfterPitch — generate the After-Pitch summary, persist it, and emit the coarse
 * company-visible event. Extracted (A16 drift-guard) so BOTH callers run the identical sequence from one
 * definition:
 *   1. The After-Pitch page's POST (on view): the rep/manager opens the page → generates on demand.
 *   2. The session-review backfill (P1, 2026-08-21 capture audit): recovers the After-Pitch for a session
 *      that was never cleanly Stopped/viewed, so it doesn't depend on the rep re-opening the page.
 *
 * The summary is ALWAYS owned by the rep (agent_id), even when a manager triggers it — the row stays
 * rep-private (3 privacy). `actorId` is who triggered generation (a viewing manager, or the agent for a
 * backfill) and only labels the coarse event. A thin/one-sided transcript honestly yields hasSignal:false
 * and stores NOTHING (3.4 — no fabrication). Never throws — the event emit is best-effort.
 */
export async function generateAndStoreAfterPitch(args: {
  companyId: string;
  sessionId: string;
  agentId: string;
  actorId: string;
  context?: SalesContext;
  outcome?: string | null;
  mode?: ExperienceMode;
}): Promise<{ generated: boolean; summary: AfterPitchSummary }> {
  const summary = await generateAfterPitchSummary({
    companyId: args.companyId,
    sessionId: args.sessionId,
    context: args.context,
    outcome: args.outcome,
    mode: args.mode,
  });
  if (!summary.hasSignal) return { generated: false, summary };

  await saveAfterPitchSummary({
    sessionId: args.sessionId,
    companyId: args.companyId,
    agentId: args.agentId,
    payload: summary,
  });

  // Gamification (Phase 3): bank this session's points from the just-saved scores. Best-effort + idempotent (the
  // ledger's unique index makes a re-run a no-op) + fast (a DB read+insert, NO LLM), so it runs inline and NEVER
  // throws into the after-pitch flow — a points failure must not break the review a rep is waiting for.
  try {
    await bankSessionPoints(args.sessionId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[gamification] bankSessionPoints failed for ${args.sessionId}:`, e instanceof Error ? e.message : e);
  }

  // Company-visible event — COARSE COUNTS ONLY, never the private scores.
  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: args.companyId,
      actor: args.actorId,
      kind: "coach.after_pitch_summary_generated",
      subject: `sales_session:${args.sessionId}`,
      payload: {
        moments_count: summary.moments.length,
        has_breakdown: summary.moments.some((m) => m.isBreakdown),
        cue_loop_count: summary.cueLoop.length,
        focus_present: summary.focus !== null,
        coach_version: "after-pitch-v1",
      },
    });
  } catch {
    /* event emit is best-effort; the summary is already saved */
  }

  return { generated: true, summary };
}
