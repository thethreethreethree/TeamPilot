/**
 * Live Sales Coach reconnect budget (2026-08-21 capture audit). Pure so the "may we try again?" decision is
 * the SINGLE source the WS handlers consume, and is unit-testable in isolation (the socket handlers around it
 * are not). Extracted after the earlier reconnect rewrite regressed capture — the budget semantics are subtle
 * enough to lock behind a test.
 *
 * Semantics: `attempts` counts CONSECUTIVE failed reconnect cycles. A (re)connect that stays open long enough
 * to prove stable resets `attempts` to 0 (done by the caller's stable-timer), so `max` bounds a run of
 * back-to-back failures — NOT total drops over a long call, which legitimately reconnects many times.
 */
export function canAttemptReconnect(args: {
  stopped: boolean; // the rep intentionally hit Stop → never auto-reconnect
  unmounted: boolean; // the component is gone → nothing to reconnect into
  attempts: number; // consecutive failed cycles so far
  max: number; // MAX_RECONNECTS
}): boolean {
  if (args.stopped || args.unmounted) return false;
  return args.attempts < args.max;
}
