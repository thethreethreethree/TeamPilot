"use client";

import { DoorOpen } from "lucide-react";

/**
 * Macro Mode toggle (per-rep, alongside the normal Sales Coach — founder decision 2026-08-18). Controlled:
 * the dashboard page owns `enabled` (so it can also focus the dashboard — hide non-macro cards + swap the stat
 * bubbles — when Macro Mode is on) and provides `onToggle`, which persists via the macro-mode route. A rep
 * flips it on to reveal the Door Log + Report Card entries.
 */
export function MacroModeToggle({
  enabled,
  saving = false,
  onToggle,
}: {
  enabled: boolean | null;
  saving?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 mt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-brand" aria-hidden />
            <span className="text-sm font-semibold text-primary">Macro Mode</span>
          </div>
          <p className="text-[11px] text-muted mt-0.5">
            Door-to-door: fast Door Log + a macro Report Card. Feedback processes in the background.
          </p>
        </div>
        <button
          onClick={onToggle}
          disabled={enabled === null || saving}
          role="switch"
          aria-checked={enabled ?? false}
          aria-label="Toggle Macro Mode"
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
            enabled ? "bg-ember-400" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {/* Nav to the three door-to-door surfaces is the home's 3 cards (Door Log / Today's Metrics / Pitch
          Performance, founder wireframe 2026-08-19) — this card is just the on/off switch now. */}
    </div>
  );
}
