"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, X } from "lucide-react";
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
// v3.2.1 — lowered from 20 to 12 after the user reported "I'm
// getting annoyed" (19 chars) didn't activate the LLM fallback when
// the regex also missed. 12 chars is the floor: shorter drafts
// ("ok", "yes", "got it!") are too low-signal to be worth a real
// LLM round trip; ≥12 covers the realistic emotional short-message
// surface ("I'm done", "this sucks", "I quit", "go away").
const LLM_MIN_DRAFT_CHARS = 12;

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
  /** v3.2 — LLM's verdict on this hit after reading context. */
  verdict: "confirmed" | "uncertain" | "vetoed";
  /** v3.2 — 1–2 sentence note specific to the user's actual draft.
   *  Shown in the closed chip; replaces the generic kindExplanation
   *  for the moment-specific read. */
  context_note: string;
  /** v3.12 — concrete, draft-specific revision proposal. Falls back
   *  to citation.suggestion (per-heuristic template) when absent. */
  revision_suggestion?: string;
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
    contextNote: string | null;
    verdict: LlmHit["verdict"] | null;
    /** v3.12 — LLM-generated draft-specific revision proposal. When
     *  present, replaces citation.suggestion in the How-to-revise card.
     *  When null, fall back to the static per-heuristic template. */
    revisionSuggestion: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pastCounts, setPastCounts] = useState<
    Partial<Record<CoachCitation["id"], number>>
  >({});
  const [llmHits, setLlmHits] = useState<LlmHit[]>([]);
  // v3.1 — surfaces a subtle "Coach reading…" pulse while the LLM call
  // is in flight. Without it, there's a 1.2s perceptual gap between
  // the regex pass and the LLM result where the user has no feedback.
  const [llmAnalyzing, setLlmAnalyzing] = useState(false);
  // v3.5 — distinguishes "haven't tried the LLM yet" from "tried, came
  // back empty." Without this, the regex-only state and the
  // LLM-read-but-found-nothing state look identical to the user — both
  // show the chip with no verdict. After a manual or auto LLM read
  // completes with no draft-specific note, we surface "System read this
  // — no specific concern beyond the pattern" so the user can tell the
  // System actually engaged.
  const [llmReadAttempted, setLlmReadAttempted] = useState(false);
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

  // Audit H1 fix (2026-06-12): `expanded` is local UI state for the
  // currently-active chip. When the active citation changes (chip
  // cycles between different heuristic fires) OR clears entirely,
  // the expanded boolean must reset — otherwise the next chip
  // resurrects in a stale expanded state. The previous code only
  // reset expanded on user-driven dismiss/refine, missing the
  // "draft cleared while chip was expanded" path.
  const activeCitationId = active?.citation.id ?? null;
  useEffect(() => {
    setExpanded(false);
  }, [activeCitationId]);

  // ─── LLM call (factored v3.5 for reuse from auto + on-demand) ────
  // The actual fetch/parse. Returns a promise so the on-demand caller
  // can await completion if it wants. `flagAttempted` controls whether
  // the resulting empty/non-empty state should be marked as a
  // user-visible "the System read this" event — auto reads still mark
  // it (so the chip's "no specific concern" state can surface), and
  // on-demand reads obviously mark it.
  const draftRef = useRef(draft);
  const recentThreadRef = useRef(recentThread);
  useEffect(() => {
    draftRef.current = draft;
    recentThreadRef.current = recentThread;
  }, [draft, recentThread]);
  const runLlmAnalyze = (flagAttempted: boolean) => {
    if (llmAbortRef.current) {
      llmAbortRef.current.abort();
      llmAbortRef.current = null;
    }
    const controller = new AbortController();
    llmAbortRef.current = controller;
    setLlmAnalyzing(true);
    const draftAtCallTime = draftRef.current;
    const recentAtCallTime = recentThreadRef.current;
    return (async () => {
      try {
        const regexHits = detectAll(draftAtCallTime).map((c) => ({
          pattern_id: c.id,
          trigger_excerpt: c.triggerExcerpt,
        }));
        const res = await fetch("/api/coach/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft: draftAtCallTime,
            recentThread: recentAtCallTime,
            regexHits,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          if (flagAttempted && !controller.signal.aborted) {
            setLlmReadAttempted(true);
          }
          return;
        }
        const data = (await res.json()) as { hits?: LlmHit[] };
        if (!controller.signal.aborted) {
          setLlmHits(data.hits ?? []);
          if (flagAttempted) setLlmReadAttempted(true);
        }
      } catch {
        // Network blip / abort — leave LLM hits alone, regex still works.
      } finally {
        if (!controller.signal.aborted) {
          setLlmAnalyzing(false);
        }
      }
    })();
  };

  // ─── LLM pass (debounced 1.2s, only on substantial drafts) ────
  // Audit C2 / M2 fix (2026-06-12): every time the draft changes we
  // (a) abort the in-flight LLM call so stale responses can't land,
  // AND (b) clear llmHits / llmAnalyzing so the merge effect can't
  // briefly see a previous draft's verdicts applied to the current
  // text. The previous code only cleared llmHits when draft dropped
  // below LLM_MIN_DRAFT_CHARS — between two long drafts, stale
  // verdicts could persist and suppress valid regex hits.
  useEffect(() => {
    if (llmDebounceRef.current !== null) {
      window.clearTimeout(llmDebounceRef.current);
    }
    if (llmAbortRef.current) {
      llmAbortRef.current.abort();
      llmAbortRef.current = null;
    }
    // CANONICAL RESET — any draft change wipes prior LLM state.
    // The next LLM call will re-populate; until it returns, only
    // regex governs detection.
    setLlmHits([]);
    setLlmAnalyzing(false);
    setLlmReadAttempted(false);
    if (draft.trim().length < LLM_MIN_DRAFT_CHARS) {
      return;
    }
    llmDebounceRef.current = window.setTimeout(() => {
      void runLlmAnalyze(true);
    }, LLM_DEBOUNCE_MS);
    return () => {
      if (llmDebounceRef.current !== null) {
        window.clearTimeout(llmDebounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, recentThread]);

  // ─── L1 audit (2026-06-12) — the confidence/verdict coupling ──
  // The same predicate `h.confidence !== "low"` filters two distinct
  // decisions below: (a) whether to apply the LLM's VERDICT to a
  // matching regex hit, and (b) whether to surface a NEW citation
  // for an LLM-only pattern hit the regex missed. Audit flagged the
  // shared threshold as coupling-by-coincidence.
  //
  // Resolved as: not-a-defect, intentionally shared. Both decisions
  // reduce to the same upstream question — "is the LLM confident
  // enough that its signal should influence behavior?" — and per
  // §0/A11 the conservative answer is "no" when confidence is low,
  // for both branches. A low-confidence verdict shouldn't overwrite
  // a regex hit's default treatment; a low-confidence novel citation
  // shouldn't bother the user. Named here so future maintainers
  // don't accidentally split the threshold thinking it's a bug, and
  // so an actual split (e.g. allow low-confidence context_notes to
  // enrich existing chips) would arrive as a deliberate constitutional
  // decision against A11 conservatism, not silently as code drift.
  const llmConfidenceCounts = (h: LlmHit) => h.confidence !== "low";

  // ─── Combined detection (regex instant + LLM verdict + enrichment) ────
  // v3.2: LLM can now VETO regex hits when context contradicts them
  // (user critiquing a word, quoting someone, hypothetical, etc.) AND
  // attach a context-specific note that replaces the generic explanation
  // in the chip. Two specific failures the user named in the screenshot:
  //   - "similar answer" → generic kindExplanation, no draft-specificity
  //   - "doesn't evaluate the message" → regex fires without reading context
  // Both are addressed by routing the regex hits through the LLM verdict
  // pass before surfacing.
  useEffect(() => {
    if (regexDebounceRef.current !== null) {
      window.clearTimeout(regexDebounceRef.current);
    }
    regexDebounceRef.current = window.setTimeout(() => {
      const regexHits = detectAll(draft);

      // Build a verdict lookup keyed by pattern_id from the LLM. We
      // accept hits at high + medium confidence only — low-confidence
      // surfaces too many false positives at the §4 readout.
      const verdicts = new Map<
        CoachCitation["id"],
        {
          verdict: LlmHit["verdict"];
          contextNote: string;
          revisionSuggestion: string | null;
        }
      >();
      for (const h of llmHits) {
        if (!llmConfidenceCounts(h)) continue;
        verdicts.set(h.pattern_id, {
          verdict: h.verdict,
          contextNote: h.context_note,
          revisionSuggestion:
            typeof h.revision_suggestion === "string" && h.revision_suggestion.length > 0
              ? h.revision_suggestion
              : null,
        });
      }

      // Filter regex hits through LLM verdicts: a "vetoed" verdict
      // suppresses the regex hit. "confirmed" + "uncertain" both
      // pass through.
      const survivingRegex = regexHits.filter((c) => {
        const v = verdicts.get(c.id);
        return !(v && v.verdict === "vetoed");
      });

      // Convert any LLM-surfaced patterns the regex DIDN'T catch
      // (verdicts the LLM rendered "confirmed" / "uncertain" with no
      // matching regex hit) into citations.
      const newLlmCitations: CoachCitation[] = llmHits
        .filter(
          (h) =>
            llmConfidenceCounts(h) &&
            h.verdict !== "vetoed" &&
            !regexHits.some((r) => r.id === h.pattern_id)
        )
        .map(citationFromLlmHit)
        .filter((c): c is CoachCitation => c !== null);

      const combined = [...survivingRegex, ...newLlmCitations];

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
      let surfaced: {
        citation: CoachCitation;
        count: number;
        contextNote: string | null;
        verdict: LlmHit["verdict"] | null;
        revisionSuggestion: string | null;
      } | null = null;
      for (const c of sorted) {
        const past = pastCounts[c.id] ?? 0;
        const total = past + 1;
        const threshold = COACH_THRESHOLDS[c.id];
        if (total >= threshold) {
          const v = verdicts.get(c.id);
          surfaced = {
            citation: c,
            count: total,
            contextNote: v?.contextNote ?? null,
            verdict: v?.verdict ?? null,
            revisionSuggestion: v?.revisionSuggestion ?? null,
          };
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

  // v3.1 — when LLM is analyzing AND no regex chip is active yet,
  // surface a subtle "Coach reading…" pulse so the user knows the
  // System is thinking. This closes the 1.2s perceptual gap between
  // typing stop and chip surface.
  if (!active) {
    if (llmAnalyzing && draft.trim().length >= LLM_MIN_DRAFT_CHARS) {
      return (
        <div
          className="mb-2 border border-[#FACC15]/15 bg-[#FACC15]/[0.03] rounded-lg px-3 py-1.5 flex items-center gap-2"
          role="status"
          aria-label="Coach reading the draft"
        >
          <Loader2
            className="w-3 h-3 text-brand/60 animate-spin"
            aria-hidden
          />
          <span className="text-[10px] text-muted uppercase tracking-widest font-mono">
            Sitting with what you wrote…
          </span>
        </div>
      );
    }
    return null;
  }

  const text = mirrorChipText(active.citation.id, active.count);
  // Trim the trigger excerpt to a single line for compact display in
  // the closed chip. The full excerpt + principle remain available
  // in the expanded view.
  const triggerSnippet = active.citation.triggerExcerpt
    .replace(/\s+/g, " ")
    .trim();
  const triggerSnippetShort =
    triggerSnippet.length > 72
      ? `${triggerSnippet.slice(0, 72)}…`
      : triggerSnippet;

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
            <p className="text-xs text-primary font-semibold mb-0.5 flex items-center gap-1.5 flex-wrap">
              {text.label}
              {/* v3.2: if the LLM verdict is "uncertain", surface that
                  subtly so the user knows the System read the context
                  but isn't certain. "confirmed" is implicit. v4.0:
                  warmed the language from "context uncertain" to a
                  more peer-like "I'm not 100% sure." */}
              {active.verdict === "uncertain" && (
                <span className="text-[9px] uppercase tracking-widest font-mono text-muted">
                  · I&apos;m not 100% sure
                </span>
              )}
            </p>
            {/* v4.0 — growth-framing tagline on recurrence. When the
                same pattern has surfaced more than once, render a
                small affirming tagline that reframes the count from
                surveillance ("3 times in this thread") to practice
                ("you've noticed this 3 times — that awareness IS the
                practice"). Silent on first occurrence; warm on every
                recurrence. The third Coach contract — making the
                writer feel they're growing — lives here. */}
            {text.recurrenceFrame && (
              <p className="text-[10px] text-brand/80 italic mb-1">
                {text.recurrenceFrame}
              </p>
            )}
            {/* Trigger excerpt — surfaced prominently in the closed
                chip state (v3.1) so the user can SEE which words fired
                the detector without expanding. */}
            {triggerSnippetShort && (
              <p className="text-[11px] text-brand mb-1 font-mono italic break-words">
                &ldquo;{triggerSnippetShort}&rdquo;
              </p>
            )}
            {/* v3.4 (2026-06-12) — the chip's primary line is the
                most draft-specific thing we have:
                  1. LLM context_note (sentence that references the
                     actual draft words)
                  2. Draft-aware fallback referencing the trigger
                     excerpt so even regex-only fires don't feel
                     generic
                  3. Last resort: the generic mirror question
                Audit M6 fix (2026-06-12): #2 requires a non-empty
                triggerSnippetShort. Regex factories guarantee this
                today, but if an LLM-only hit ever surfaces with an
                empty excerpt the previous render produced "You wrote
                '' —" nonsense. Three-state ternary falls through to
                #3 when #2's precondition isn't met. */}
            {/* v3.7 (2026-06-12) — dedupe. When expanded AND contextNote
                exists, the "System's read on this draft" card below shows
                the same exact sentence — rendering it here too produces
                the "same response twice" duplication the user flagged.
                Suppress this line in the expanded+contextNote case; the
                closed state still shows it as the at-a-glance preview. */}
            {active.contextNote && !expanded ? (
              <p className="text-[11px] text-primary leading-relaxed">
                {active.contextNote}
              </p>
            ) : active.contextNote && expanded ? null : triggerSnippetShort ? (
              <p className="text-[11px] text-secondary leading-relaxed">
                You wrote &ldquo;{triggerSnippetShort}&rdquo; — {text.question.toLowerCase()}
              </p>
            ) : (
              <p className="text-[11px] text-secondary leading-relaxed">
                {text.question}
              </p>
            )}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] text-muted font-mono uppercase tracking-widest flex items-center gap-2">
                {active.citation.source}
                {/* v3.4: visible state indicator so the user can tell
                    whether the LLM actually read the context (its
                    verdict landed) vs the regex-only state where the
                    chip uses static principle text. Without this, the
                    expanded view looked identical for every fire. */}
                {/* v4.0 — warmed up the verdict badges. Old version
                    said "System read the context · verdict: confirmed"
                    (clinical) and "Regex-only · LLM didn't read
                    context" (cold AND surfaced lesser-than). New
                    badges use peer-like first-person: "I read your
                    full message" vs "Quick pattern catch." Both are
                    honest; neither makes the user feel they're
                    getting the lesser version. */}
                {active.verdict === "confirmed" && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded normal-case tracking-normal font-sans bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    I read your full message
                  </span>
                )}
                {active.verdict === "uncertain" && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded normal-case tracking-normal font-sans bg-ember-400/10 text-brand border border-ember-400/30">
                    I read it — not 100% sure
                  </span>
                )}
                {!active.verdict && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded normal-case tracking-normal font-sans bg-surface text-muted border border-default">
                    Quick pattern catch
                  </span>
                )}
              </p>
              {/* v3.4: when the LLM produced a context-specific note,
                  it goes FIRST in the expanded view as the primary
                  read for this exact draft. The static principle stays
                  below as durable theory. */}
              {active.contextNote && (
                <div className="rounded-lg bg-ember-400/10 border border-ember-400/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-widest font-mono text-brand mb-1">
                    Here&apos;s what I&apos;m seeing
                  </p>
                  <p className="text-xs text-primary leading-relaxed">
                    {active.contextNote}
                  </p>
                </div>
              )}
              {/* v3.5 (2026-06-12) — honesty repair. Previously the
                  expanded view ALWAYS rendered active.citation.kindExplanation
                  (a static paragraph keyed to the heuristic ID) directly
                  beneath the "Regex-only · LLM didn't read context"
                  badge. The badge said "I didn't read this draft"; the
                  paragraph below it READ like a draft-specific reading.
                  Two contradictory claims rendered as one unit — the
                  "same response" the user kept flagging. The static
                  paragraph stays only when the System actually read AND
                  had nothing draft-specific to add. Otherwise we show
                  an honest state + an explicit "have the System read
                  this" trigger. */}
              {!active.contextNote && llmAnalyzing && (
                <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-widest font-mono">
                  <Loader2 className="w-3 h-3 text-brand/60 animate-spin" aria-hidden />
                  Sitting with what you wrote…
                </div>
              )}
              {!active.contextNote && !llmAnalyzing && !llmReadAttempted && (
                <button
                  type="button"
                  onClick={() => {
                    void runLlmAnalyze(true);
                  }}
                  className="text-[11px] text-brand hover:text-[#EAB308] underline underline-offset-2 self-start"
                >
                  Want me to read this draft fully?
                </button>
              )}
              {!active.contextNote && !llmAnalyzing && llmReadAttempted && (
                <p className="text-[10px] text-muted leading-relaxed italic">
                  I read it — nothing specific beyond the pattern shape itself.
                </p>
              )}
              {/* v3.7 (2026-06-12) — actionable revision guidance was
                  authored in citation.suggestion all along but the
                  expanded view never rendered it. A14: data path had
                  the actionable text; render path didn't consume it.
                  v3.12 (2026-06-12) — user flagged citation.suggestion
                  as "100% the same all the time" — accurate, because
                  it's a per-heuristic template with only the trigger
                  excerpt interpolated. Now we prefer the LLM's
                  draft-specific revision_suggestion (which proposes a
                  concrete rewrite of THIS draft) and fall back to the
                  static template only when the LLM isn't available or
                  didn't generate one. The presence of a small badge
                  signals which source is rendering — honesty over
                  uniform polish. */}
              {/* v4.0 — the demoralizing "Generic template (no LLM
                  read)" badge is GONE. The previous v3.12 design
                  surfaced an honest-but-cold distinction between
                  LLM-generated and template revisions, which made the
                  template path feel lesser-than. The static citation
                  .suggestion IS genuinely good coaching content; the
                  user shouldn't be told they're getting a worse
                  version when they're getting a perfectly fine one.
                  The text itself signals quality (LLM revisions
                  reference actual draft words). When LLM did contribute,
                  a tiny green pulse indicator nods to it — no scolding
                  label when it didn't. */}
              <div className="rounded-lg bg-surface border border-default p-2.5 mt-1">
                <p className="text-[10px] uppercase tracking-widest font-mono text-brand mb-1 flex items-center gap-2">
                  Want to try this?
                  {active.revisionSuggestion && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      aria-label="Tailored to your draft"
                      title="Tailored to your draft"
                    />
                  )}
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  {active.revisionSuggestion ?? active.citation.suggestion}
                </p>
              </div>
              {/* v3.7: the "Underlying principle" + kindExplanation pair
                  was the "unclear guidance" the user flagged — both are
                  abstract framings, and showing them prominently
                  produced theory-not-help. The principle stays as a
                  collapsible "Why this matters" footnote at the bottom
                  of the chip — durable theory available to readers who
                  want it, without crowding out the actionable revision
                  guidance above. kindExplanation is removed: it
                  duplicates the principle's abstract framing without
                  adding draft-specific value. The System's-read card
                  (above) is the draft-specific reading; "How to revise"
                  is the actionable; principle is the theory. Three
                  honest layers, no duplication. */}
              <details className="mt-1">
                <summary className="text-[10px] text-muted uppercase tracking-widest font-mono cursor-pointer hover:text-secondary">
                  If you&apos;re curious about the thinking behind this
                </summary>
                <p className="text-[11px] text-secondary leading-relaxed italic border-l-2 border-[#FACC15]/40 pl-2 mt-1">
                  {active.citation.principle}
                </p>
              </details>
              {/* v4.0 — dismiss button autonomy-affirming. Old text
                  "Keep as-is — pattern is intentional" implicitly
                  framed sending the original as a defiant choice
                  ("you're keeping the pattern even though I flagged
                  it"). The new "Send as written" is neutral and trusts
                  the writer's judgment — A11 mirror frame in tone, not
                  just structure. */}
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
                  Send as written
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
