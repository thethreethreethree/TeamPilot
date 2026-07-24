"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Dashboard module error boundary — scoped to /dashboard/** (except
 * /dashboard/care/**, which has its own more-specific boundary at
 * src/app/dashboard/care/error.tsx that catches first).
 *
 * Generalizes the same fix the C.A.R.E boundary made (2026-06-19,
 * React #310 crash the founder reported on mobile) to its sibling
 * modules — finance, operations, chats, sales-coach, CRM, problems,
 * etc. Without this, a crash in any of those propagated to the global
 * boundary at src/app/error.tsx, which replaced the WHOLE page with a
 * generic 'SOMETHING BROKE' screen and lost the dashboard chrome
 * (sidebar, top bar) the user was operating in.
 *
 * With this boundary the exception is caught HERE, still inside
 * dashboard/layout.tsx — the sidebar stays, and Retry re-runs the
 * failed render (recovers transient network/race blips without a full
 * reload). Additive-only: it renders solely when a child throws, so it
 * cannot affect the happy path.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort log so the real stack trace is in DevTools when the
    // founder or an engineer opens the page that crashed — otherwise the
    // generic banner is the only signal.
    // eslint-disable-next-line no-console
    console.error("[dashboard] error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 md:px-8 py-12">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-700 dark:text-red-300">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 dark:text-red-300">
            This section hit an error
          </p>
          <h1 className="text-lg font-semibold text-primary">
            We couldn&apos;t render this page.
          </h1>
          <p className="text-xs text-muted leading-relaxed">
            Retry usually recovers; if it doesn&apos;t, head back to the
            Command Center and try again.
          </p>
        </div>
        <div className="bg-base/40 border border-default rounded-lg p-3 text-left">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-1">
            Error
          </p>
          <p className="text-[11px] font-mono text-red-700 dark:text-red-300 break-words">
            {error.message || "Unknown render failure."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted font-mono mt-2">
              digest: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-4 py-2 rounded-md text-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-4 py-2 rounded-md transition-colors"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            Command Center
          </Link>
        </div>
      </div>
    </div>
  );
}
