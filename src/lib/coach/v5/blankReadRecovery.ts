import type { CaptureGap } from "./captureGap";

/**
 * blankReadRecovery — should the After-Pitch screen show the MANUAL one-tap recovery
 * card? (Extracted 2026-08-14 so the §3.4 honesty invariant is lockable in a node test —
 * the page component has no render harness.)
 *
 * The manual card is now the FALLBACK to the automatic server re-transcribe:
 *   - customer-missing gap → the page auto-fires /auto-recover first. The card appears
 *     ONLY if auto-recover resolved without recovering (could-not-decide / already-
 *     attempted / failed) — i.e. `autoRecoverResolved` — so the rep can tap the speaker
 *     manually. It must NOT show while auto-recover is still in flight (that would show
 *     a "tap to recover" card the system is already handling).
 *   - agent-missing gap → auto-recover keys on the customer-missing (talk_ratio caveat)
 *     signal and does not handle this direction, so the card is the recovery path
 *     immediately.
 *   - null gap (healthy / starved two-sided read) → never show it. Offering re-transcribe
 *     when both sides WERE captured is the false diagnosis the 2026-08-14 audit flagged.
 *
 * Requires saved audio in every case (nothing to re-transcribe otherwise). The card copy
 * is chosen from `gap` so it never asserts a wrong side (see the page component).
 */
export function shouldOfferBlankReadRecovery(args: {
  gap: CaptureGap;
  hasSavedRecording: boolean;
  /** true once /auto-recover has returned a non-recovered terminal for this session. */
  autoRecoverResolved: boolean;
}): boolean {
  if (!args.hasSavedRecording || args.gap === null) return false;
  if (args.gap === "agent-missing") return true; // auto-recover doesn't own this direction
  // customer-missing: only after the automatic attempt has resolved without recovering.
  return args.autoRecoverResolved;
}
