/**
 * Starting crash reporting, if this build is meant to have any.
 *
 * SEPARATE FROM `crash-reporting.ts` ON PURPOSE. That module holds the rules
 * about what may leave the device and imports nothing, so those rules are
 * testable. This one touches the native SDK and cannot be tested here — which
 * is exactly why it contains as little judgement as possible.
 *
 * NO DSN, NO CLIENT. Not a disabled client, not a client that drops events:
 * `init` is never called. A build made before anyone has decided where its
 * crashes should go reports nothing to anyone, which is the right default when
 * that build may end up on a rep's phone.
 */
import * as Sentry from '@sentry/react-native';

import { recordCrash } from './crash-log-store';
import { reportingEnabled, scrub } from './crash-reporting';
import {
  WHERE_FATAL,
  WHERE_REJECTION,
  WHERE_UNCAUGHT,
  createRejectionGate,
} from './crash-uncaught';

/** Read from the environment like every other setting. Optional by design. */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function startCrashReporting(): void {
  if (!reportingEnabled(DSN)) return;
  Sentry.init({
    dsn: DSN,
    // Matches the website's sampling, so the two products cost and behave alike.
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
    environment: __DEV__ ? 'development' : 'production',
    // The SDK will not attach request bodies, headers or user identifiers by
    // itself. Everything this app sends, it sends deliberately.
    sendDefaultPii: false,
    /**
     * The last gate before anything leaves the device.
     *
     * This app records customer conversations, so an event is scrubbed rather
     * than trusted: the message, and every breadcrumb, go through the same rules
     * the tests pin. A signed recording URL or a JWT here would be a real leak.
     */
    beforeSend(event) {
      if (event.message) {
        event.message = scrub(event.message) ?? '[removed]';
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          message: b.message ? (scrub(b.message) ?? '[removed]') : b.message,
          // Breadcrumb data is arbitrary and unbounded — the likeliest place a
          // transcript or a customer's words would ride along. Dropped whole.
          data: undefined,
        }));
      }
      return event;
    },
  });
}

/**
 * Report a caught render error.
 *
 * WHY THIS EXISTS. `components/error-boundary.tsx` carried a TODO for months —
 * *"forward to real crash reporting before the store release"* — and the store
 * release is now the thing being prepared. Until this, a boundary that fired on
 * a rep's phone in the field wrote to a console nobody would ever read: the
 * screen said "that did not work" to the rep, and said nothing to anyone who
 * could fix it.
 *
 * SAFE WHEN REPORTING IS OFF, which is its normal state today. With no DSN,
 * `Sentry.init` never ran, and this returns without touching the SDK. The
 * console line is kept either way, because in development it is the thing a
 * developer actually sees.
 *
 * THE SCRUBBING STILL APPLIES. This goes through `captureException`, so the
 * `beforeSend` above runs on it exactly as it does on any other event — an
 * error message carrying a signed recording URL is cleaned on the way out
 * rather than trusted because it came from our own boundary.
 */
export function reportCaughtError(error: unknown, where: string): void {
  console.error(`[${where}]`, error);
  /**
   * THE LOCAL LOG IS FIRST, AND IS NOT GATED ON THE DSN.
   *
   * Everything below this line only runs in a build somebody has bought a crash
   * service for. No such build exists today, so without this line the paragraph
   * above describes a system that has never once reported anything. The phone's
   * own log always runs, so a rep in the field can open Report a problem and
   * send what broke regardless of what the business has or has not paid for.
   *
   * Fire and forget: a boundary is rendering a fallback right now and must not
   * wait on storage. A failure inside is swallowed by the store.
   */
  void recordCrash(error, where);
  if (!reportingEnabled(DSN)) return;
  try {
    Sentry.captureException(error, { tags: { boundary: where } });
  } catch {
    // A crash reporter that crashes must not take the screen down with it. The
    // boundary's whole job is to be the last thing standing.
  }
}

/**
 * Catch the failures nothing else is catching.
 *
 * Two hooks, both installed once, at app entry, next to `startCrashReporting`.
 * The rules they apply live in `crash-uncaught.ts` and are tested; this function
 * holds only the parts that need the runtime and therefore cannot be.
 *
 * SENTRY IS NOT CALLED FROM HERE, on purpose. When a DSN is set, `Sentry.init`
 * has already installed its own global handler — which this one chains to. Also
 * calling `captureException` would report every uncaught error twice.
 */
export function installUncaughtHandlers(): void {
  if (installed) return;
  installed = true;
  installGlobalErrorHandler();
  installRejectionTracker();
}

let installed = false;

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

type ErrorUtilsShape = {
  getGlobalHandler?: () => GlobalHandler | undefined;
  setGlobalHandler?: (handler: GlobalHandler) => void;
};

/**
 * Everything thrown that no `catch` and no error boundary took.
 *
 * CHAINED, NEVER REPLACED. The handler already there is what shows the red
 * screen in development and what ends the process in production. Swallowing it
 * would turn a crash into a frozen app — the worst of both, and invisible.
 *
 * THE FATAL CASE DELAYS THAT CHAIN, which is the one liberty taken here. The log
 * is written through AsyncStorage, so it is asynchronous; on a fatal error the
 * default handler tears the process down and the write never lands. That is the
 * loss `crash-log.ts` already admits to in the copy for an empty log — "a
 * failure took the process down before anything could be written" — and it is
 * the failure most worth having. So the crash is held for as long as the write
 * needs, capped, and then passed on. The app is already dead at this point; the
 * only question is whether it leaves a note.
 */
function installGlobalErrorHandler(): void {
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (typeof utils?.setGlobalHandler !== 'function') return;
  const previous = utils.getGlobalHandler?.();

  utils.setGlobalHandler((error, isFatal) => {
    const where = isFatal ? WHERE_FATAL : WHERE_UNCAUGHT;
    const pass = () => {
      try {
        previous?.(error, isFatal);
      } catch {
        // The handler we chain to is not ours. If it fails there is nothing left
        // above us to tell, and throwing here would replace a real crash with a
        // crash inside the crash handler.
      }
    };

    if (!isFatal) {
      // The app lives on, so the write has all the time it needs and the screen
      // must not wait for it.
      void recordCrash(error, where);
      pass();
      return;
    }

    void Promise.race([recordCrash(error, where), waitMs(FATAL_WRITE_GRACE_MS)]).then(pass, pass);
  });
}

/**
 * How long a fatal crash is held open for its own log entry to be written.
 *
 * Generous enough for one AsyncStorage round trip on a slow phone, short enough
 * that if storage is what is broken the app still dies rather than hanging in a
 * state the rep cannot escape.
 */
const FATAL_WRITE_GRACE_MS = 1500;

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type HermesShape = {
  hasPromise?: () => boolean;
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, reason: unknown) => void;
    onHandled: (id: number) => void;
  }) => void;
};

/**
 * Unhandled promise rejections — in the build a rep actually runs.
 *
 * ONLY OUTSIDE DEVELOPMENT, and that is the point rather than a limitation.
 * React Native installs this same tracker under `__DEV__` so that an unhandled
 * rejection reaches LogBox; there can be one tracker, and in development LogBox
 * in front of a developer beats a line in a log file. In a release build React
 * Native installs nothing at all, so the slot is empty and a rejected promise
 * disappears without trace. This fills exactly that slot.
 *
 * The grace window in `createRejectionGate` is what makes this safe to record:
 * without it, ordinary code that attaches its `catch` a tick later would be
 * reported to a rep as a failure.
 */
function installRejectionTracker(): void {
  if (__DEV__) return;
  const hermes = (globalThis as { HermesInternal?: HermesShape }).HermesInternal;
  if (!hermes?.hasPromise?.()) return;
  if (typeof hermes.enablePromiseRejectionTracker !== 'function') return;

  const gate = createRejectionGate((reason) => {
    void recordCrash(reason, WHERE_REJECTION);
  });

  hermes.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (id, reason) => gate.unhandled(id, reason),
    onHandled: (id) => gate.handled(id),
  });
}
