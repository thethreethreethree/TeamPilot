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
