/**
 * Sentry server-side configuration (Node runtime).
 *
 * Catches errors in API routes, server components, server actions,
 * and the Next.js server itself. Same DSN-gated no-op pattern as
 * the client config.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
  });
}
