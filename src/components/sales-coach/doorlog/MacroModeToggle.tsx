"use client";

import Link from "next/link";
import { DoorOpen, BarChart3, Target } from "lucide-react";

/**
 * Macro Mode toggle (per-rep, alongside the normal Sales Coach — founder decision 2026-08-18). Controlled:
 * the dashboard page owns `enabled` (so it can also focus the dashboard — swap the launchpad for the 3 door
 * cards + the stat bubbles — when Macro Mode is on) and provides `onToggle`, which persists via the macro-mode
 * route. A rep flips it on to reveal the door-to-door surfaces.
 *
 * `showLinks` (desktop only): the MOBILE home shows the 3 door surfaces as its own cards, so it passes false and
 * this card is just the switch. The DESKTOP dashboard has no such cards, so it passes true and this card carries
 * the nav to Door Log / Today's Metrics / Pitch Performance (regression fix 2026-08-19 — removing this left
 * desktop Macro reps with no way to reach the surfaces).
 */
export function MacroModeToggle({
  enabled,
  saving = false,
  onToggle,
  showLinks = false,
}: {
  enabled: boolean | null;
  saving?: boolean;
  onToggle: () => void;
  showLinks?: boolean;
}) {
  return (
    <div className="rounded-xl border border-default bg-surface p-3.5 mt-3">
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
          /*
           * THE OFF TRACK IS MODE-AWARE. It was `bg-white/15` — white at 15%, which is a faint
           * grey on the matte-black field and NOTHING on cream. In light mode this switch rendered
           * as a bare white knob floating with no track: a control you cannot identify as a
           * control, in a state you cannot read.
           *
           * Caught by rendering the home in both themes and comparing (2026-09-24). It is also a
           * candidate explanation for the founder's own words — "i can't see the button" — which
           * is why it is fixed here rather than filed.
           *
           * ink-300 on light / ink-700 on dark: a visible track on each ground, and on dark it
           * lands close to what white/15 used to look like, so the appearance a rep knows does
           * not change.
           */
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
            enabled ? "bg-ember-400" : "bg-ink-300 dark:bg-ink-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Desktop nav to the 3 door-to-door surfaces (mobile shows them as home cards instead). */}
      {enabled && showLinks && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Link
            href="/dashboard/sales-coach/doors"
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-ember-400 text-[#09090B] text-xs font-semibold text-center"
          >
            <DoorOpen className="w-4 h-4" aria-hidden /> Door Log
          </Link>
          <Link
            href="/dashboard/sales-coach/doors/todays-metrics"
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-surface border border-default text-primary text-xs font-semibold text-center"
          >
            <Target className="w-4 h-4" aria-hidden /> Today&apos;s Metrics
          </Link>
          <Link
            href="/dashboard/sales-coach/doors/report-card"
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-surface border border-default text-primary text-xs font-semibold text-center"
          >
            <BarChart3 className="w-4 h-4" aria-hidden /> Pitch Perf.
          </Link>
        </div>
      )}
    </div>
  );
}
