"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Activity, RefreshCw, ArrowLeft } from "lucide-react";

/**
 * Application error boundary.
 *
 * Caught at the segment level. Receives the error object and a reset() to
 * retry the segment. We do NOT log the error to a 3rd-party service — we
 * surface it honestly and offer two recovery paths.
 *
 * `digest` is useful when a 500 reaches a customer: they can give us that
 * short hash and we can correlate it server-side. We render it inline so the
 * report is one click of "copy" away from being useful.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so developers see the stack in dev. In production this
    // is invisible — a structured logger / Sentry hook would go here.
    // eslint-disable-next-line no-console
    console.error("[App error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-base text-primary flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold tracking-tight">ELOSTATE</span>
        </div>

        <p className="text-[10px] uppercase tracking-widest text-red-300 mb-3 font-mono">
          something broke
        </p>
        <h1 className="text-2xl font-bold text-primary leading-tight mb-3">
          The page hit an error.
        </h1>
        <p className="text-sm text-secondary leading-relaxed mb-3">
          The error is shown below. You can try the same step again, or go
          back to the dashboard.
        </p>

        <div className="bg-surface border border-red-500/30 rounded-xl p-4 mb-6 text-left">
          <p className="text-[10px] uppercase tracking-widest text-red-300 mb-2">
            error
          </p>
          <p className="text-sm text-primary break-words font-mono">
            {error.message || "Unknown error"}
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted mt-3 font-mono">
              digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-colors text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-2.5 rounded-lg transition-colors text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
