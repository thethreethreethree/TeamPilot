import { useRef, useCallback } from "react";

/**
 * Synchronous re-entrancy latch for submit handlers.
 *
 * A double-click fires both onClicks BEFORE React re-renders the button to `disabled={busy}` — the state flag is
 * applied a render too late — so the flag alone lets the second click's write through. On an append-only ledger
 * or a payment POST that means a DUPLICATE (audit 2026-08-19: the finance write surfaces guarded only on
 * `disabled={busy}`, unlike ResolutionCaptureModal / FeedbackPanel / operations which use a synchronous ref).
 *
 * `run(fn)` executes `fn` only when no run is in flight; the ref flips SYNCHRONOUSLY (before the first await), and
 * resets in a `finally` so a thrown fetch can't wedge the latch shut (which `setBusy(false)`-not-in-finally
 * handlers can). Concurrent (sub-frame) double-fires are dropped; ordinary sequential submits are unaffected.
 */
export function useSubmitLatch(): (fn: () => Promise<void>) => Promise<void> {
  const inFlight = useRef(false);
  return useCallback(async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await fn();
    } finally {
      inFlight.current = false;
    }
  }, []);
}
