"use client";

import { Sparkles } from "lucide-react";
import { useRemoteMacroMode } from "@/lib/hooks/useRemoteMacroMode";

/**
 * The Remote Sales Macro Mode switch (0303) — the rep's own, separate from Sales Coach's. On: Remote Sales becomes
 * the simplified system (Today · Pipeline · Calls, and three tabs per call). Off: the full module. Always reachable
 * from Calls in both modes, so it can never become a one-way door.
 */
export function RemoteMacroToggle() {
  const { enabled, saving, error, setMode } = useRemoteMacroMode();
  return (
    <div className="rounded-xl border border-default bg-surface p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4 text-brand" aria-hidden />
            Macro Mode
          </p>
          {enabled !== null && (
            <p className="mt-0.5 text-[11px] text-muted">
              {enabled
                ? "On: your day, your pipeline and your calls — each call as Highlights, Coaching and Next Meeting."
                : "Off: the full Remote Sales module. Turn it on for the simple view: Today, Pipeline and Calls."}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled ?? false}
          aria-label="Macro Mode"
          disabled={enabled === null || saving}
          onClick={() => void setMode(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-brand" : "bg-ink-300 dark:bg-ink-700"}`}
        >
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{error}</p>}
    </div>
  );
}
