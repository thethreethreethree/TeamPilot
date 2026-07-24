"use client";

import { useEffect } from "react";

/**
 * Customer-facing widget error boundary — scoped to /widget/** (the embedded
 * C.A.R.E chat that runs on the tenant's own site).
 *
 * Without this, a render crash in the widget fell through to the global boundary
 * at src/app/error.tsx — a DASHBOARD-oriented "SOMETHING BROKE" screen with links
 * to /dashboard. Shown inside a customer's embedded widget that is wrong on two
 * counts: it points a customer at an internal app they can't reach, and it exposes
 * the raw error message (an internal detail an end-customer should never see).
 *
 * This boundary is deliberately MINIMAL and customer-appropriate: a neutral
 * "temporarily unavailable" line + Retry, NO internal error text, NO app links.
 * The real stack still goes to the console for the operator's DevTools. Additive-
 * only — renders solely when the widget throws, so zero happy-path effect.
 */
export default function WidgetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Operator-side signal only; never surfaced to the visitor.
    // eslint-disable-next-line no-console
    console.error("[care widget] error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-base">
      <div className="max-w-xs w-full text-center space-y-3">
        <h1 className="text-sm font-semibold text-primary">
          Chat is temporarily unavailable
        </h1>
        <p className="text-xs text-muted leading-relaxed">
          Something went wrong loading the chat. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-4 py-2 rounded-md text-xs transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
