"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Sparkles, X } from "lucide-react";
import type {
  CoachAnalysisRequest,
  CoachAnalysisResponse,
  CoachContextType,
  CoachContextPayload,
  CoachAnalysisMode,
} from "@/lib/coach/v5/types";

/**
 * CoachPanelV5 — the conversational Coach surface.
 *
 * Replaces the v4.0 regex-primary chip with an LLM-primary panel that
 * supports:
 *   - Auto-Coach (passive, debounced) — Coach speaks only when needed
 *   - Ask-Coach (active) — user invokes; Coach speaks either way
 *   - Conversational follow-up (Sprint 3 will add multi-turn)
 *   - Accept-gated-by-why flow (user sees the teaching BEFORE the
 *     accept option lands)
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md
 *
 * Sprint 2 scope: single-turn analysis + accept/dismiss UI. Multi-turn
 * conversational depth comes in Sprint 3.
 */

const AUTO_DEBOUNCE_MS = 1500;
const MIN_DRAFT_CHARS_FOR_AUTO = 12;

type ActiveAnalysis = {
  request: CoachAnalysisRequest;
  response: CoachAnalysisResponse;
};

type PanelState =
  | { kind: "idle" }
  | { kind: "analyzing"; mode: CoachAnalysisMode }
  | { kind: "showing"; active: ActiveAnalysis }
  | { kind: "error"; message: string };

export function CoachPanelV5({
  draft,
  contextType,
  contextPayload,
  onAcceptRevision,
  /** Allows the parent to trigger Ask-Coach mode externally — typically
   *  from an AskCoachButton in the composer footer. */
  askCoachToken,
}: {
  draft: string;
  contextType: CoachContextType;
  contextPayload: CoachContextPayload;
  onAcceptRevision?: (revision: string) => void;
  askCoachToken?: number;
}) {
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastAnalyzedDraftRef = useRef<string>("");

  /** The shared analyze function — used by both Auto-Coach and Ask-Coach. */
  const runAnalyze = async (mode: CoachAnalysisMode) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const request: CoachAnalysisRequest = {
      mode,
      draft,
      contextType,
      contextPayload,
    };

    setState({ kind: "analyzing", mode });

    try {
      const res = await fetch("/api/coach/v5/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({
          kind: "error",
          message: errBody?.error ?? `Coach unavailable (HTTP ${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as {
        response?: CoachAnalysisResponse;
        suppressed?: boolean;
      };
      if (controller.signal.aborted) return;
      if (data.suppressed || !data.response) {
        // Brain layer suppressed the call (e.g., §3.4 control window).
        // In auto mode, we stay silent. In ask mode, we surface it.
        if (mode === "ask") {
          setState({
            kind: "error",
            message: "Coach is in §3.4 control window — guidance suppressed",
          });
        } else {
          setState({ kind: "idle" });
        }
        return;
      }
      const response = data.response;

      // Auto-Coach honesty rule: if Coach doesn't need to improve the
      // draft, stay silent. The user didn't ask. Don't interrupt them.
      if (mode === "auto" && !response.needsImprovement) {
        setState({ kind: "idle" });
        return;
      }

      setState({
        kind: "showing",
        active: { request, response },
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Coach call failed",
      });
    }
  };

  // ─── Auto-Coach debounce effect ─────────────────────────
  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Reset the panel on every draft change. Stale analyses must not
    // bleed across drafts (A14 + canonical-reset discipline carried
    // forward from v4.0 audit).
    setState({ kind: "idle" });

    const trimmed = draft.trim();
    if (trimmed.length < MIN_DRAFT_CHARS_FOR_AUTO) return;
    // Skip auto-analyze if the draft hasn't actually changed (e.g., a
    // re-render with the same draft after the user dismisses the chip).
    if (trimmed === lastAnalyzedDraftRef.current) return;

    debounceRef.current = window.setTimeout(() => {
      lastAnalyzedDraftRef.current = trimmed;
      void runAnalyze("auto");
    }, AUTO_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, contextType]);

  // ─── Ask-Coach trigger ──────────────────────────────────
  useEffect(() => {
    if (askCoachToken === undefined) return;
    // askCoachToken is a counter the parent increments to request a
    // fresh Ask-Coach analysis. Skip the initial mount value of 0.
    if (askCoachToken === 0) return;
    void runAnalyze("ask");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askCoachToken]);

  const dismiss = () => {
    setState({ kind: "idle" });
  };

  const acceptRevision = (revision: string) => {
    onAcceptRevision?.(revision);
    setState({ kind: "idle" });
  };

  // ─── Render ─────────────────────────────────────────────

  if (state.kind === "idle") return null;

  if (state.kind === "analyzing") {
    return (
      <div
        className="mb-2 border border-[#FACC15]/15 bg-[#FACC15]/[0.03] rounded-lg px-3 py-1.5 flex items-center gap-2"
        role="status"
        aria-label="Coach analyzing the draft"
      >
        <Loader2 className="w-3 h-3 text-brand/60 animate-spin" aria-hidden />
        <span className="text-[10px] text-muted uppercase tracking-widest font-mono">
          {state.mode === "ask" ? "Coach is reading..." : "Sitting with what you wrote..."}
        </span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        className="mb-2 border border-red-500/20 bg-red-500/[0.04] rounded-lg px-3 py-2 flex items-start gap-2"
        role="alert"
      >
        <span className="text-[11px] text-red-300/80 leading-relaxed flex-1">
          {state.message}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted hover:text-secondary p-0.5"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  // state.kind === "showing"
  const { response } = state.active;
  return (
    <div
      className="mb-2 border border-[#FACC15]/30 bg-[#FACC15]/5 rounded-lg px-3 py-2.5"
      role="region"
      aria-label="Coach analysis"
    >
      <div className="flex items-start gap-2">
        <BookOpen className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 space-y-2">
          {/* Affirmation — present for correct drafts or as a strength
              acknowledgment on improvable drafts. Always rendered first. */}
          {response.affirmation && (
            <div className="flex items-start gap-2">
              <Sparkles className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-xs text-primary leading-relaxed">
                {response.affirmation}
              </p>
            </div>
          )}

          {/* Improvement block — when Coach has a rewrite to offer. The
              "why" comes FIRST, then the suggestion. Accept is gated by
              the why having been displayed (it's right there above). */}
          {response.improvement && (
            <>
              <div className="rounded-lg bg-ember-400/10 border border-ember-400/30 p-2.5 space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
                  Here's what I'm seeing
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  {response.improvement.whyContext}
                </p>
              </div>

              <div className="rounded-lg bg-surface border border-default p-2.5 space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
                  Want to try this?
                </p>
                <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                  {response.improvement.suggestedRevision}
                </p>
                <p className="text-[11px] text-secondary leading-relaxed border-l-2 border-[#FACC15]/40 pl-2 italic">
                  {response.improvement.whySentence}
                </p>
                <p className="text-[10px] text-muted font-mono uppercase tracking-wider">
                  {response.improvement.principleCited.name}
                  {" — "}
                  {response.improvement.principleCited.book}
                  {response.improvement.secondaryPrinciple && (
                    <>
                      {" + "}
                      {response.improvement.secondaryPrinciple.name}
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    response.improvement && acceptRevision(response.improvement.suggestedRevision)
                  }
                  className="text-[11px] font-semibold text-[#09090B] bg-[#FACC15] hover:bg-[#EAB308] px-2.5 py-1 rounded-md transition-colors"
                >
                  Use this revision
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-[11px] text-muted hover:text-secondary"
                >
                  Send as written
                </button>
              </div>
            </>
          )}

          {/* Conversation starters — Sprint 3 will make these interactive.
              For Sprint 2 they render as hints only, so the user can see
              the conversational depth that's coming. */}
          {response.conversationStarters.length > 0 && (
            <div className="pt-1 border-t border-[#FACC15]/15">
              <p className="text-[10px] uppercase tracking-widest font-mono text-muted mb-1.5">
                You could ask me
              </p>
              <ul className="space-y-0.5">
                {response.conversationStarters.slice(0, 3).map((q, i) => (
                  <li key={i} className="text-[11px] text-secondary leading-relaxed">
                    · {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss coach"
          className="text-muted hover:text-secondary p-0.5"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
