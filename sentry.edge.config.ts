/**
 * Sentry edge-runtime configuration.
 *
 * Catches errors in middleware and edge routes. Same pattern as
 * the server config — DSN-gated, no-op when missing.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
    environment: process.env.VERCEL_ENV ?? "development",
  });
}
