"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import {
  detectAll,
  detectIdentityCollision,
  detectNvcEvaluation,
  detectBareAssertion,
  detectBlameProjection,
  detectEmotionalEscalation,
  detectHotState,
  detectAggressiveLanguage,
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
 * CoachPanel — v3 (mirror frame + LLM pattern detection).
 *
 * v3 (2026-06-12) adds an LLM pass that supplements the regex
 * detection. The regex catches patterns with explicit lexicon
 * ("stupid", "always", "we should"). The LLM catches patterns whose
 * shape is identifiable but vocabulary varies — blame projection in
 * non-canonical forms, hot-state signaling, emotional escalation
 * with novel words.
 *
 * The user's example "I'm hungry and you guys are making mad" was
 * the canonical case the regex-only Coach missed: blame projection
 * + hot-state signaling, neither using the rigid lexicon the old
 * regex matched against.
 *
 * Lifecycle:
 *   1. On mount: load past pattern_observed counts for (current user,
 *      subject, each heuristic) from the §3.1 chain.
 *   2. Every (debounced) draft change:
 *      a. Run instant regex detectors. Surface immediately if any
 *         hit clears its threshold.
 *      b. If the draft is >= 20 chars, also fire the LLM analyze
 *         call (debounced 1.2s). When it returns, merge its hits
 *         with the regex hits — LLM hits at "high" or "medium"
 *         confidence promote that pattern id into the citation list.
 *   3. If LLM is unavailable / rate-limited / errors: fall back to
 *      regex-only silently. Coach v2 behavior is the lower bound.
 *
 * A11 mirror frame still holds: the LLM identifies which pattern
 * shape is present (factual); the chip surfaces count + question;
 * the user judges. The LLM's vocabulary is constrained at both the
 * prompt level and the API filter — it cannot return a freeform
 * "this is wrong" verdict.
 */

const REGEX_DEBOUNCE_MS = 350;
const LLM_DEBOUNCE_MS = 1200;
const LLM_MIN_DRAFT_CHARS = 20;

type CitationFactory = (text: string) => CoachCitation | null;

const FACTORY_BY_ID: Record<CoachCitation["id"], CitationFactory> = {
  "nvc-evaluation": detectNvcEvaluation,
  "voss-bare-assertion": detectBareAssertion,
  "stone-identity-collision": detectIdentityCollision,
  "coach-blame-projection": detectBlameProjection,
  "coach-emotional-escalation": detectEmotionalEscalation,
  "coach-hot-state": detectHotState,
  "coach-aggressive-language": detectAggressiveLanguage,
};

// Order matches detectAll priority — used to pick "the most important
// hit" when multiple come back from regex + LLM combined.
const PRIORITY_ORDER: CoachCitation["id"][] = [
  "stone-identity-collision",
  "coach-aggressive-language",
  "coach-blame-projection",
  "nvc-evaluation",
  "coach-emotional-escalation",
  "coach-hot-state",
  "voss-bare-assertion",
];

type LlmHit = {
  pattern_id: CoachCitation["id"];
  trigger_excerpt: string;
  confidence: "high" | "medium" | "low";
};

/** Synthesize a CoachCitation for an LLM hit. Re-uses the existing
 *  citation factories so the chip + kindExplanation match what the
 *  regex pass would produce. If the factory returns null (because
 *  the regex can't see what the LLM saw), we still synthesize a
 *  citation from the LLM's excerpt. */
function citationFromLlmHit(hit: LlmHit): CoachCitation | null {
  const fromRegex = FACTORY_BY_ID[hit.pattern_id](hit.trigger_excerpt);
  if (fromRegex) return fromRegex;
  // Build a minimal citation by piggy-backing on the trigger phrase.
  // The regex factories' principles + kindExplanations are encoded
  // off the heuristic id; we hand-roll a placeholder set for cases
  // where the LLM saw a pattern the regex would have missed.
  const seedCitation = FACTORY_BY_ID[hit.pattern_id]("seed phrase that triggers the regex pattern: always stupid we should");
  if (seedCitation) {
    return { ...seedCitation, triggerExcerpt: hit.trigger_excerpt };
  }
  return null;
}

export function CoachPanel({
  subject,
  draft,
  onRefine,
  recentThread,
}: {
  /** Chain-event subject — see emit.ts for the convention. */
  subject: string;
  draft: string;
  /** Recent thread excerpt for LLM context (last few messages joined
   *  with newlines). Optional — if omitted, the LLM works draft-only. */
  recentThread?: string;
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
  const [llmHits, setLlmHits] = useState<LlmHit[]>([]);
  const lastFiredIdRef = useRef<string | null>(null);
  const regexDebounceRef = useRef<number | null>(null);
  const llmDebounceRef = useRef<number | null>(null);
  const llmAbortRef = useRef<AbortController | null>(null);

  const subjectRef = useRef(subject);
  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  // Load past pattern counts on mount + subject change.
  useEffect(() => {
    let cancelled = false;
    void fetchPatternCounts({ subject }).then((counts) => {
      if (!cancelled) setPastCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  // ─── LLM pass (debounced 1.2s, only on substantial drafts) ────
  useEffect(() => {
    if (llmDebounceRef.current !== null) {
      window.clearTimeout(llmDebounceRef.current);
    }
    // Abort any in-flight LLM call when the draft changes — we want
    // the response to match the CURRENT draft, not a stale one.
    if (llmAbortRef.current) {
      llmAbortRef.current.abort();
      llmAbortRef.current = null;
    }
    if (draft.trim().length < LLM_MIN_DRAFT_CHARS) {
      setLlmHits([]);
      return;
    }
    llmDebounceRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      llmAbortRef.current = controller;
      void (async () => {
        try {
          const res = await fetch("/api/coach/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draft, recentThread }),
            signal: controller.signal,
          });
          if (!res.ok) {
            // Silent fallback — Coach v2 (regex) is the lower bound.
            return;
          }
          const data = (await res.json()) as { hits?: LlmHit[] };
          if (!controller.signal.aborted) {
            setLlmHits(data.hits ?? []);
          }
        } catch {
          // Network blip / abort — leave LLM hits alone, regex still works.
        }
      })();
    }, LLM_DEBOUNCE_MS);
    return () => {
      if (llmDebounceRef.current !== null) {
        window.clearTimeout(llmDebounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, recentThread]);

  // ─── Combined detection (regex instant + LLM enriched) ────────
  useEffect(() => {
    if (regexDebounceRef.current !== null) {
      window.clearTimeout(regexDebounceRef.current);
    }
    regexDebounceRef.current = window.setTimeout(() => {
      const regexHits = detectAll(draft);
      // Convert LLM hits (high + medium confidence only) into citations.
      // Low-confidence is suppressed — surfaces too many false positives.
      const llmCitations: CoachCitation[] = llmHits
        .filter((h) => h.confidence === "high" || h.confidence === "medium")
        .map(citationFromLlmHit)
        .filter((c): c is CoachCitation => c !== null);

      // Merge: regex first (it's authoritative on what it matches),
      // then any LLM patterns NOT already covered.
      const seenIds = new Set(regexHits.map((c) => c.id));
      const combined: CoachCitation[] = [...regexHits];
      for (const c of llmCitations) {
        if (!seenIds.has(c.id)) {
          combined.push(c);
          seenIds.add(c.id);
        }
      }

      if (combined.length === 0) {
        setActive(null);
        lastFiredIdRef.current = null;
        return;
      }

      // Pick highest-priority hit whose count clears the threshold.
      const sorted = [...combined].sort(
        (a, b) =>
          PRIORITY_ORDER.indexOf(a.id) - PRIORITY_ORDER.indexOf(b.id)
      );
      let surfaced: { citation: CoachCitation; count: number } | null = null;
      for (const c of sorted) {
        const past = pastCounts[c.id] ?? 0;
        const total = past + 1;
        const threshold = COACH_THRESHOLDS[c.id];
        if (total >= threshold) {
          surfaced = { citation: c, count: total };
          break;
        }
      }
      setActive(surfaced);
      if (surfaced && surfaced.citation.id !== lastFiredIdRef.current) {
        lastFiredIdRef.current = surfaced.citation.id;
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
    }, REGEX_DEBOUNCE_MS);
    return () => {
      if (regexDebounceRef.current !== null) {
        window.clearTimeout(regexDebounceRef.current);
      }
    };
  }, [draft, pastCounts, llmHits]);

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
              <p className="text-[11px] text-secondary leading-relaxed">
                {active.citation.kindExplanation}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={refine}
                  className="text-[11px] font-semibold text-[#09090B] bg-[#FACC15] hover:bg-[#EAB308] px-2.5 py-1 rounded-md transition-colors"
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
