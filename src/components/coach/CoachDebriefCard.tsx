"use client";

import { GraduationCap, Sparkles, Target } from "lucide-react";
import type { CoachDebrief } from "@/lib/coach/v5/types";

/**
 * CoachDebriefCard — the end-of-conversation Coach debrief surface.
 *
 * Renders the two-part teaching moment shown when a conversation ends
 * (Team Chat close, C.A.R.E resolve):
 *   - "What you learned"  — what the user did well, grounded in real
 *     messages.
 *   - "Your current edge" — what to work on (may be absent — a clean
 *     conversation honestly has nothing here, §3.4).
 *
 * Presentational only. The parent decides WHEN to render it (after the
 * close/resolve action) and owns the data fetch. When hasSignal is
 * false the parent shows the lighter "nothing to flag" line instead of
 * this card — see the `emptyState` export.
 *
 * Voice + framing per §3.3 (guide-don't-overtake): this teaches, it
 * does not grade. No scores, no character judgments — only moves and
 * what to carry forward.
 */
export function CoachDebriefCard({
  debrief,
  loading,
  onReviewWithCoach,
}: {
  debrief: CoachDebrief | null;
  loading?: boolean;
  /** Optional — wires the "Review with Coach" affordance if the surface
   *  supports opening the full Coach. Omit to hide the CTA. */
  onReviewWithCoach?: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-arc-400/[0.04] border border-arc-400/20 p-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" aria-hidden />
          Coach is putting together your debrief…
        </div>
      </div>
    );
  }

  if (!debrief || !debrief.hasSignal) return null;

  const hasWorkOn = debrief.workOn.length > 0;

  return (
    <div className="rounded-xl bg-arc-400/[0.04] border border-arc-400/25 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-arc-300" aria-hidden />
        <h3 className="text-xs font-semibold text-primary tracking-wide">
          Your debrief
        </h3>
      </div>

      {debrief.learned.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted">
            What you did well
          </p>
          <ul className="space-y-1.5">
            {debrief.learned.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Sparkles
                  className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0"
                  aria-hidden
                />
                <span className="text-xs text-primary leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasWorkOn && (
        <section className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted">
            Your current edge
          </p>
          <ul className="space-y-1.5">
            {debrief.workOn.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Target
                  className="w-3.5 h-3.5 text-gold-400 mt-0.5 flex-shrink-0"
                  aria-hidden
                />
                <span className="text-xs text-primary leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {debrief.closing && (
        <p className="text-xs text-secondary leading-relaxed italic border-t border-arc-400/15 pt-2.5">
          {debrief.closing}
        </p>
      )}

      {onReviewWithCoach && hasWorkOn && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReviewWithCoach}
            className="text-[11px] text-arc-300 hover:text-arc-200 border border-arc-400/30 hover:border-arc-400/50 rounded-md px-2.5 py-1 transition-colors"
          >
            Review with Coach
          </button>
        </div>
      )}
    </div>
  );
}
