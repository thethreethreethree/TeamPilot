/**
 * The rules for failures NOBODY CAUGHT.
 *
 * WHAT WAS MISSING. `reportCaughtError` runs from the error boundary, so the log
 * holds render errors and the outbox failures `crash-notable` selects. Two whole
 * classes never reached it:
 *
 *   1. An uncaught throw outside a render — a native module's callback, a timer,
 *      anything the boundary is not wrapping. React never sees it, so nothing
 *      records it.
 *   2. An unhandled promise rejection. React Native installs its rejection
 *      tracker ONLY under `__DEV__` (`Libraries/Core/polyfillPromise.js`), so in
 *      the binary a rep actually runs, a rejected promise nobody awaited is
 *      completely silent — no LogBox, no console, nothing. This codebase is full
 *      of deliberate `void somePromise()` calls, which are exactly the ones that
 *      would vanish.
 *
 * Both end at the same place a caught error does: the phone's own log, which the
 * rep can read and send. No DSN, no account, no third party.
 *
 * PURE, so the one piece of real judgement here — the grace window below — is
 * testable, while the native wiring in `crash-init.ts` stays as dumb as possible.
 */

/**
 * What the report calls each kind, in words a rep can match to what they saw.
 *
 * These become the row title (`describeEntry`) and the heading of a numbered
 * item in the sent report, so they are phrases rather than error jargon. A rep
 * reading "TypeError: undefined is not an object" learns nothing; "the app
 * stopped" they can place against the moment it happened.
 */
export const WHERE_UNCAUGHT = 'A problem the app did not catch';
export const WHERE_FATAL = 'A crash that stopped the app';
export const WHERE_REJECTION = 'A background task failed';

/**
 * How long a rejection is held before it counts as unhandled.
 *
 * THIS IS THE WHOLE DESIGN OF THE REJECTION PATH. The tracker's `allRejections`
 * mode reports a rejection as unhandled as soon as the tick it was rejected in
 * ends — but attaching a `.catch()` one tick later is ordinary, correct code,
 * and the tracker then calls `onHandled` to take it back. Recording immediately
 * would mean a rep's problem report lists failures that never happened, and a
 * report that cries wolf is worse than an empty one: it sends whoever reads it
 * hunting a bug that does not exist.
 *
 * So a rejection waits. If it is handled inside the window, it is dropped and
 * never seen. If the window closes on it, nothing is ever going to handle it and
 * it is a real failure.
 *
 * Two seconds because it must comfortably outlast a chain of awaits that ends in
 * a `catch` — a request with a retry inside it, say — while still landing in the
 * log long before a rep who just watched something fail opens Report a problem.
 */
export const REJECTION_GRACE_MS = 2000;

/**
 * The most rejections held at once.
 *
 * A loop that rejects forever would otherwise hold a timer per rejection. The
 * log itself keeps twenty entries and folds repeats, so a storm is fully
 * described by its first few; past this the rest are dropped rather than queued.
 */
export const MAX_PENDING = 32;

/** Injected so the test does not have to wait two seconds per case. */
export type Timers = {
  schedule: (fn: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
};

export type RejectionGate = {
  /** The tracker believes this one is unhandled. Starts the clock. */
  unhandled: (id: number, reason: unknown) => void;
  /** It was handled after all. Cancels it if the window is still open. */
  handled: (id: number) => void;
  /** How many are waiting on the clock. For the test, and for nothing else. */
  pending: () => number;
};

/**
 * Hold rejections for the grace window, then record what is left.
 *
 * `record` is called at most once per id, and never for an id that was handled
 * in time.
 */
export function createRejectionGate(
  record: (reason: unknown) => void,
  graceMs: number = REJECTION_GRACE_MS,
  // Cast at the boundary rather than typing the gate to a platform handle: the
  // return of setTimeout is a number on a device and a Timeout object under
  // node --test, and the gate must not care which runtime it is standing in.
  timers: Timers = {
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
  },
): RejectionGate {
  const waiting = new Map<number, unknown>();

  return {
    unhandled(id, reason) {
      // Already waiting: the tracker re-reported the same id. One clock, not two.
      if (waiting.has(id)) return;
      if (waiting.size >= MAX_PENDING) return;
      const handle = timers.schedule(() => {
        // Deleted FIRST so that a `record` which itself throws cannot leave the
        // id stuck in the map forever, slowly filling the cap.
        waiting.delete(id);
        record(reason);
      }, graceMs);
      waiting.set(id, handle);
    },

    handled(id) {
      const handle = waiting.get(id);
      if (handle === undefined) return;
      waiting.delete(id);
      timers.cancel(handle);
    },

    pending() {
      return waiting.size;
    },
  };
}
