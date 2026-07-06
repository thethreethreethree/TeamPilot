import type { TranscriptSpeaker } from "@/lib/data/salesCoach";

/**
 * L2 cue-coordination — the pure decision logic behind "start the cue clock at
 * commit for an obvious prospect turn, then reconcile once the LLM /attribute
 * settles the label" (useLiveCoaching.ts). Extracted here because it is the
 * session's most timing-sensitive path (the schedule-at-commit optimization
 * fires a cue AHEAD of the LLM confirming the speaker) and was previously
 * untested — AUDIT-2026-06-02 flagged unprotected structural invariants as
 * critical. These functions ENCODE the intended coordination so it can be
 * regression-pinned; the hook calls them, it does not re-implement them.
 *
 * IMPORTANT (§3.4, mirrors the in-hook comment): reconcile's "cancel" is
 * BEST-EFFORT at the call site — it only prevents the cue if /attribute returns
 * before the settle timer fires. This module decides the ACTION; whether a
 * clearTimeout still has a live timer to cancel is the caller's timing reality.
 */

/**
 * At turn commit: should we start the cue clock NOW (before the LLM), because
 * the instant content tell already says the prospect spoke? Only for an
 * auto-coach, non-manual-locked turn whose content tell is an obvious customer.
 */
export function shouldScheduleCueAtCommit(args: {
  locked: boolean;
  contentGuess: TranscriptSpeaker | null;
  autoCoach: boolean;
}): boolean {
  return !args.locked && args.contentGuess === "customer" && args.autoCoach;
}

export type CueReconcileAction = "schedule" | "keep" | "cancel" | "none";

/**
 * After /attribute settles the label, reconcile against whatever the commit
 * scheduler did:
 *  - prospect + still the latest turn + auto-coach:
 *      already scheduled at commit → "keep" (don't reset; that re-adds latency);
 *      not yet scheduled → "schedule" (the LLM is first to determine prospect).
 *  - was scheduled at commit but the LLM DISAGREES (not customer) → "cancel".
 *  - otherwise → "none".
 */
export function reconcileCueAfterClassify(args: {
  scheduledAtCommit: boolean;
  // undefined tolerated: the caller derives this from an optional-chain fallback
  // (settled label ?? provisional). It's treated exactly like "not customer".
  finalSpeaker: TranscriptSpeaker | null | undefined;
  isLatestTurn: boolean;
  autoCoach: boolean;
}): CueReconcileAction {
  if (args.finalSpeaker === "customer" && args.isLatestTurn && args.autoCoach) {
    return args.scheduledAtCommit ? "keep" : "schedule";
  }
  if (args.scheduledAtCommit && args.finalSpeaker !== "customer") {
    return "cancel";
  }
  return "none";
}
