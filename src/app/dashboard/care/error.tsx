"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * C.A.R.E module error boundary — scoped to /dashboard/care/**.
 *
 * Without this, a crash in any C.A.R.E surface (ConversationsApp,
 * CareShell, secondary settings) propagated to the global error
 * boundary at src/app/error.tsx, which forced the user back to the
 * generic 'SOMETHING BROKE' screen and lost the visual context of
 * the C.A.R.E module they were operating in.
 *
 * With this boundary, an exception inside C.A.R.E is caught here
 * and rendered with the user still inside the dashboard chrome
 * (sidebar, top bar, mobile drawer all intact). The Retry button
 * resets the boundary's state and re-runs the failed render — for
 * transient issues (network blip, race) this recovers without a
 * full reload.
 *
 * Per Wave (2026-06-19) — added in response to the React #310
 * crash the founder reported on mobile.
 */
export default function CareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort log to the console so the actual stack trace is
    // available in DevTools when the founder or an engineer opens
    // the page that crashed. Without this the error boundary's
    // generic banner is the only signal.
    // eslint-disable-next-line no-console
    console.error("[care] error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 md:px-8 py-12">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-300">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-red-300">
            C.A.R.E module hit an error
          </p>
          <h1 className="text-lg font-semibold text-primary">
            We couldn&apos;t render this surface.
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
          <p className="text-[11px] font-mono text-red-300 break-words">
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
