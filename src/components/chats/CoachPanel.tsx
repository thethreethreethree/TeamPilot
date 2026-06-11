"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import {
  detectAll,
  mirrorChipText,
  COACH_THRESHOLDS,
  type CoachCitation,
} from "@/lib/coach/heuristics";
import {
  emitCoachOffered,
  emitCoachAccepted,
  emitCoachDismissed,
} from "@/lib/coach/emit";
import { fetchPatternCounts } from "@/lib/coach/counts";

/**
 * CoachPanel — v2 (mirror frame).
 *
 * Per asset A11: the System does not judge; it mirrors. The chip no
 * longer asserts a verdict on the user's draft ("Reads as evaluation").
 * Instead it surfaces a COUNT of past + current-draft occurrences of
 * the heuristic's pattern, asks the user a question, and lets them
 * render the verdict.
 *
 * Lifecycle:
 *   1. On mount (and when subject changes), load past
 *      `coach.pattern_observed` events for (current user, subject,
 *      each heuristic) from the §3.1 chain. These are counts of
 *      hits on POSTED messages — durable record, not draft state.
 *   2. On every (debounced) draft change, run detectors. For each
 *      heuristic hit on the current draft, add 1 to the past count.
 *   3. If the running total ≥ the heuristic's threshold, surface
 *      the mirror chip with the count + a question. Otherwise no
 *      chip.
 *   4. The first surface of a chip emits coach.suggestion_offered
 *      with mode="mirror" and mirror_count = total. Accept /
 *      dismiss emit the same way as v1.
 *
 * NOTE: this component does NOT log new pattern_observed events
 * itself — those land via `observePatterns` called from the
 * surface's post handler (chat post, task post, feedback submit).
 */

const DEBOUNCE_MS = 350;

export function CoachPanel({
  subject,
  draft,
  onRefine,
}: {
  /** Chain-event subject — see emit.ts for the convention. Examples:
   *  "chat_topic:<id>", "task:<id>", "decision:<id>", "feedback:draft",
   *  "smoke_test_result:draft". */
  subject: string;
  draft: string;
  /** Called when the user accepts a suggestion. Parent can use the
   *  callback to (e.g.) focus the textarea so the user can rewrite. */
  onRefine?: (citation: CoachCitation) => void;
}) {
  const [active, setActive] = useState<{
    citation: CoachCitation;
    count: number;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pastCounts, setPastCounts] = useState<
    Partial<Record<CoachCitation["id"], number>>
  >({});
  const lastFiredIdRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  // `subject` is often a template literal in callers (`task:${id}`)
  // which creates a new string identity on every parent render. Ref
  // pattern keeps the emit subject current without re-running the
  // debounce effect on every parent render.
  const subjectRef = useRef(subject);
  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  // Load past pattern counts on mount + when subject actually changes
  // (not on every render — useEffect deps are simple primitives).
  useEffect(() => {
    let cancelled = false;
    void fetchPatternCounts({ subject }).then((counts) => {
      if (!cancelled) setPastCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  // Re-run detectors on debounced draft. For each hit, combine with
  // the past count to decide whether the mirror threshold is crossed.
  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      const hits = detectAll(draft);
      if (hits.length === 0) {
        setActive(null);
        lastFiredIdRef.current = null;
        return;
      }
      // Walk hits in priority order; surface the highest-priority
      // hit whose running total clears its threshold.
      let surfaced: { citation: CoachCitation; count: number } | null = null;
      for (const c of hits) {
        const past = pastCounts[c.id] ?? 0;
        const total = past + 1; // +1 for the current draft hit
        const threshold = COACH_THRESHOLDS[c.id];
        if (total >= threshold) {
          surfaced = { citation: c, count: total };
          break;
        }
      }
      setActive(surfaced);
      if (surfaced && surfaced.citation.id !== lastFiredIdRef.current) {
        lastFiredIdRef.current = surfaced.citation.id;
        // Emit one offered event per UNIQUE heuristic surfaced in
        // this draft session, with the mirror count for the readout.
        void emitCoachOffered({
          subject: subjectRef.current,
          citation: surfaced.citation,
          draftExcerpt: draft,
          mirrorCount: surfaced.count,
        });
      }
      if (!surfaced) {
        lastFiredIdRef.current = null;
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [draft, pastCounts]);

  if (!active) return null;

  const text = mirrorChipText(active.citation.id, active.count);

  const refine = () => {
    void emitCoachAccepted({
      subject: subjectRef.current,
      citation: active.citation,
      draftExcerpt: draft,
      mirrorCount: active.count,
    });
    onRefine?.(active.citation);
    setActive(null);
    setExpanded(false);
  };

  const dismiss = () => {
    void emitCoachDismissed({
      subject: subjectRef.current,
      citation: active.citation,
      draftExcerpt: draft,
      mirrorCount: active.count,
    });
    setActive(null);
    setExpanded(false);
  };

  return (
    <div
      className="mb-2 border border-[#FACC15]/30 bg-[#FACC15]/5 rounded-lg px-3 py-2"
      role="region"
      aria-label="Conversational coach mirror"
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
              {text.label}
            </p>
            <p className="text-[11px] text-secondary leading-relaxed">
              {text.question}
            </p>
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
                {active.citation.source}
              </p>
              <p className="text-[11px] text-secondary leading-relaxed italic border-l-2 border-[#FACC15]/40 pl-2">
                {active.citation.principle}
              </p>
              {/* Kind, compassionate, concise explanation — programmed
                  into every chip by design. Tone constraints (A11):
                  general context about the pattern, never personally
                  corrective. */}
              <p className="text-[11px] text-secondary leading-relaxed">
                {active.citation.kindExplanation}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={refine}
                  className="text-[11px] font-semibold text-white bg-[#FACC15] hover:bg-[#EAB308] px-2.5 py-1 rounded-md transition-colors"
                >
                  Refine and revise
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-[11px] text-muted hover:text-secondary"
                >
                  Keep as-is — pattern is intentional
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss coach mirror"
          className="text-muted hover:text-secondary p-0.5"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
