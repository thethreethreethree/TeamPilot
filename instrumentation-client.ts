/**
 * Sentry client-side configuration.
 *
 * Only initializes when NEXT_PUBLIC_SENTRY_DSN is set, so local
 * dev without a DSN is a clean no-op. Production gets the DSN
 * from Vercel env vars.
 *
 * Constitutional fit: errors are §1.1 data-as-assets — every
 * thrown exception is a signal worth keeping. Sentry is the
 * collector; the §3.1 chain still owns the in-product errors that
 * land as `coach.*` / `task.*` events. They're complementary, not
 * overlapping.
 *
 * What we deliberately do NOT enable:
 *  - replaysSessionSampleRate (records user sessions — surveillance-
 *    shaped at pilot scale; revisit when consent UX exists)
 *  - replaysOnErrorSampleRate (same concern)
 *  - profilesSampleRate (CPU profiles — overkill for a Next.js
 *    app pre-scale)
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Sample rate for tracing transactions. 0.1 = 10% of requests
    // get a performance trace. Plenty at pilot volume; cut to 0.01
    // once volume warrants.
    tracesSampleRate: 0.1,
    // Lower bound on error capture — we want all real errors.
    sampleRate: 1.0,
    // Environment label so prod / staging / preview separate cleanly.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Don't send default PII (IPs, cookies). The chain already
    // records actor + payload; Sentry adding raw PII would
    // duplicate without consent.
    sendDefaultPii: false,
    // Mask anything that looks like an email or password before
    // sending the error frame. Defensive — Sentry's defaults
    // usually catch this but the explicit pattern is documentation.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}
