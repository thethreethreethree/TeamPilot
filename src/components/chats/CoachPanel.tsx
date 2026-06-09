"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { detectAll, type CoachCitation } from "@/lib/coach/heuristics";
import {
  emitCoachOffered,
  emitCoachAccepted,
  emitCoachDismissed,
} from "@/lib/coach/emit";

/**
 * CoachPanel — surfaces a heuristic citation when the user's draft
 * triggers one of the Coach detectors.
 *
 * Constitutional shape (per ThinkerThinker Asset A3):
 *   - Citation, not auto-rewrite. The user keeps authorship.
 *   - Three actions: Refine (apply suggestion), Keep (dismiss with
 *     reason), or just ignore. Send-through always allowed.
 *
 * Lifecycle in chain:
 *   - First trigger of a heuristic on this draft → coach.suggestion_offered
 *   - User clicks "Refine and revise" → component clears, parent
 *     can splice the suggestion into the textarea; we wait to emit
 *     accepted/dismissed until the user takes the terminal action
 *     (send or further-refine-leads-to-no-trigger).
 *   - User dismisses via X → coach.suggestion_dismissed
 *
 * The visible chip is one citation at a time (highest priority first
 * — identity > evaluation > assertion). Suppressed lower-priority
 * triggers still emit `offered` so the readout sees them.
 *
 * NB: the component is purely additive — when the topic has
 * coach_enabled = false, parent doesn't render this at all and the
 * composer behaves exactly like before. That's the A3 default-OFF
 * discipline.
 */

const DEBOUNCE_MS = 350;

export function CoachPanel({
  subject,
  draft,
  onRefine,
}: {
  /** Chain-event subject — see emit.ts for the convention. Examples:
   *  "chat_topic:<id>", "task:<id>", "decision:<id>", "feedback:draft",
   *  "smoke_test_result:draft". The readout buckets by the prefix
   *  before `:` so new surfaces auto-appear. */
  subject: string;
  draft: string;
  /** Called when the user accepts a suggestion. Parent can use the
   *  callback to (e.g.) focus the textarea so the user can rewrite. */
  onRefine?: (citation: CoachCitation) => void;
}) {
  const [active, setActive] = useState<CoachCitation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const lastFiredIdRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Re-run detectors on debounced draft. We don't want to fire an
  // offered event on every keystroke — that would flood the chain
  // and over-count the same draft state. Debounce + suppress
  // duplicates (only fire offered when the detected heuristic id
  // changes for this draft).
  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      const all = detectAll(draft);
      const top = all[0] ?? null;
      setActive(top);
      if (top && top.id !== lastFiredIdRef.current) {
        lastFiredIdRef.current = top.id;
        // Emit one offered event per UNIQUE heuristic that triggered
        // on this draft session. Suppressed (lower-priority) triggers
        // also emit so the readout sees the full picture.
        for (const c of all) {
          void emitCoachOffered({
            subject,
            citation: c,
            draftExcerpt: draft,
          });
        }
      }
      if (!top) {
        lastFiredIdRef.current = null;
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [draft, subject]);

  if (!active) return null;

  const refine = () => {
    void emitCoachAccepted({
      subject,
      citation: active,
      draftExcerpt: draft,
    });
    onRefine?.(active);
    setActive(null);
    setExpanded(false);
  };

  const dismiss = () => {
    void emitCoachDismissed({
      subject,
      citation: active,
      draftExcerpt: draft,
    });
    setActive(null);
    setExpanded(false);
  };

  return (
    <div
      className="mb-2 border border-[#C8232C]/30 bg-[#C8232C]/5 rounded-lg px-3 py-2"
      role="region"
      aria-label="Conversational coach suggestion"
    >
      <div className="flex items-start gap-2">
        <BookOpen
          className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left w-full"
          >
            <p className="text-xs text-primary font-semibold mb-0.5">
              {active.label}
            </p>
            <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
              {active.source}
            </p>
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-secondary leading-relaxed">
                {active.principle}
              </p>
              <p className="text-[11px] text-secondary leading-relaxed italic border-l-2 border-[#C8232C]/40 pl-2">
                {active.suggestion}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={refine}
                  className="text-[11px] font-semibold text-white bg-[#C8232C] hover:bg-[#A91D24] px-2.5 py-1 rounded-md transition-colors"
                >
                  Refine and revise
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-[11px] text-muted hover:text-secondary"
                >
                  Keep as-is
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss coach suggestion"
          className="text-muted hover:text-secondary p-0.5"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
