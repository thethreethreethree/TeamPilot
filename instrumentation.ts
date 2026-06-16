/**
 * Next.js instrumentation entry point.
 *
 * Per @sentry/nextjs v10+: server and edge runtimes initialize via
 * dynamic imports keyed on `process.env.NEXT_RUNTIME`. The client
 * runtime initializes from `instrumentation-client.ts` (also at
 * the project root).
 *
 * No-op when SENTRY_DSN is unset — the individual config files
 * already guard on the DSN being present.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js 16 / Sentry SDK v10+ renamed the request-error capture
// export from `onRequestError` to `captureRequestError`. Next.js
// still looks up the same instrumentation hook by either name in
// recent versions, but the import has to match what the SDK
// actually exports. Re-export aliased so Next.js sees the
// `onRequestError` symbol it expects.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
