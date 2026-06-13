"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import type {
  CoachAnalysisRequest,
  CoachAnalysisResponse,
  CoachContextType,
  CoachContextPayload,
  CoachAnalysisMode,
  CoachFollowUpResponse,
} from "@/lib/coach/v5/types";

/**
 * CoachPanelV5 — the conversational Coach surface.
 *
 * Replaces the v4.0 regex-primary chip with an LLM-primary panel that
 * supports:
 *   - Auto-Coach (passive, debounced) — Coach speaks only when needed
 *   - Ask-Coach (active) — user invokes; Coach speaks either way
 *   - Conversational follow-up (Sprint 3) — clickable starters + free-form input
 *   - Accept-gated-by-why flow (user sees the teaching BEFORE the
 *     accept option lands)
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md
 */

const AUTO_DEBOUNCE_MS = 1500;
const MIN_DRAFT_CHARS_FOR_AUTO = 12;

type ActiveAnalysis = {
  request: CoachAnalysisRequest;
  response: CoachAnalysisResponse;
};

/** A turn in the conversation between user and Coach after the initial
 *  analysis has surfaced. The Coach's reply may carry an alternative
 *  revision the user can accept (replacing or augmenting the original
 *  improvement.suggestedRevision). */
type Turn =
  | { role: "user"; content: string }
  | { role: "coach"; content: string; alternativeRevision?: string };

type PanelState =
  | { kind: "idle" }
  | { kind: "analyzing"; mode: CoachAnalysisMode }
  | { kind: "showing"; active: ActiveAnalysis; turns: Turn[]; followingUp: boolean; latestStarters: string[] }
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
        turns: [],
        followingUp: false,
        latestStarters: response.conversationStarters,
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
    // Suppress auto re-analysis on the revision text we just produced.
    // Without this, accepting the revision flips the parent's draft to
    // the Coach's own output, the useEffect on `draft` re-fires, and
    // 1.5s later the Coach gets called on its own text — wasteful and
    // structurally absurd (the Coach evaluating its own suggestion).
    //
    // We mark the trimmed revision as "already analyzed" so the next
    // draft-change effect sees draft === lastAnalyzedDraftRef and skips.
    // If the user then edits the revision themselves, the trim will
    // differ and analysis resumes correctly.
    lastAnalyzedDraftRef.current = revision.trim();
    onAcceptRevision?.(revision);
    setState({ kind: "idle" });
  };

  /** Send a follow-up question to the Coach. Used by both clickable
   *  conversation starters and the free-form input. */
  const sendFollowUp = async (userQuestion: string) => {
    if (state.kind !== "showing") return;
    const question = userQuestion.trim();
    if (!question) return;

    const userTurn: Turn = { role: "user", content: question };
    const turnsWithUser: Turn[] = [...state.turns, userTurn];

    setState({
      ...state,
      turns: turnsWithUser,
      followingUp: true,
    });

    try {
      const res = await fetch("/api/coach/v5/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          contextType,
          contextPayload,
          priorTurns: turnsWithUser.map((t) => ({
            role: t.role,
            content: t.content,
          })),
          userQuestion: question,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        const errorTurn: Turn = {
          role: "coach",
          content: errBody?.error ?? `Coach unavailable (HTTP ${res.status})`,
        };
        // Refresh state freely — the user may have dismissed the panel
        // mid-call, in which case we silently no-op via the next check.
        setState((curr) =>
          curr.kind === "showing"
            ? {
                ...curr,
                turns: [...turnsWithUser, errorTurn],
                followingUp: false,
              }
            : curr
        );
        return;
      }

      const data = (await res.json()) as {
        response?: CoachFollowUpResponse;
        suppressed?: boolean;
      };

      if (data.suppressed || !data.response) {
        const suppressedTurn: Turn = {
          role: "coach",
          content: "Coach is in §3.4 control window — guidance temporarily suppressed.",
        };
        setState((curr) =>
          curr.kind === "showing"
            ? {
                ...curr,
                turns: [...turnsWithUser, suppressedTurn],
                followingUp: false,
              }
            : curr
        );
        return;
      }

      const coachTurn: Turn = {
        role: "coach",
        content: data.response.reply,
        ...(data.response.alternativeRevision && {
          alternativeRevision: data.response.alternativeRevision,
        }),
      };

      setState((curr) =>
        curr.kind === "showing"
          ? {
              ...curr,
              turns: [...turnsWithUser, coachTurn],
              followingUp: false,
              latestStarters: data.response!.conversationStarters,
            }
          : curr
      );
    } catch (err) {
      const errorTurn: Turn = {
        role: "coach",
        content: err instanceof Error ? err.message : "Follow-up call failed",
      };
      setState((curr) =>
        curr.kind === "showing"
          ? {
              ...curr,
              turns: [...turnsWithUser, errorTurn],
              followingUp: false,
            }
          : curr
      );
    }
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

          {/* Conversational turns — Sprint 3. Each user question + Coach
              reply pair renders here. The Coach's reply may carry an
              alternativeRevision the user can adopt directly. */}
          {state.turns.length > 0 && (
            <div className="pt-2 border-t border-[#FACC15]/15 space-y-2">
              {state.turns.map((turn, i) => (
                <TurnBubble
                  key={i}
                  turn={turn}
                  onUseAlternative={(rev) => acceptRevision(rev)}
                />
              ))}
              {state.followingUp && (
                <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-widest font-mono">
                  <Loader2 className="w-3 h-3 text-brand/60 animate-spin" aria-hidden />
                  Coach is thinking…
                </div>
              )}
            </div>
          )}

          {/* Conversation starters — clickable. Each click fires a
              follow-up call with the starter as the user's question. The
              starters update after each Coach reply. */}
          {!state.followingUp && state.latestStarters.length > 0 && (
            <div className="pt-2 border-t border-[#FACC15]/15">
              <p className="text-[10px] uppercase tracking-widest font-mono text-muted mb-1.5">
                {state.turns.length === 0 ? "You could ask me" : "Or ask"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {state.latestStarters.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void sendFollowUp(q)}
                    className="text-[11px] text-left text-secondary hover:text-primary bg-surface hover:bg-[#FACC15]/[0.08] border border-default rounded-full px-2.5 py-1 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Free-form follow-up input — always available when the
              Coach is in showing state. The user can ask anything; the
              follow-up route handles it as a conversational turn. */}
          <FollowUpInput
            disabled={state.followingUp}
            onSend={(q) => void sendFollowUp(q)}
          />
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

/** Render a single turn in the conversation — either user question or
 *  Coach reply. Coach replies may include an alternative revision the
 *  user can accept. */
function TurnBubble({
  turn,
  onUseAlternative,
}: {
  turn: Turn;
  onUseAlternative: (revision: string) => void;
}) {
  if (turn.role === "user") {
    return (
      <div className="flex items-start gap-2 pl-4">
        <MessageCircle className="w-3 h-3 text-muted mt-0.5 flex-shrink-0" aria-hidden />
        <p className="text-[11px] text-muted leading-relaxed italic flex-1 break-words">
          {turn.content}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <BookOpen className="w-3 h-3 text-brand mt-0.5 flex-shrink-0" aria-hidden />
        <p className="text-xs text-primary leading-relaxed flex-1 whitespace-pre-wrap break-words">
          {turn.content}
        </p>
      </div>
      {turn.alternativeRevision && (
        <div className="ml-5 rounded-lg bg-surface border border-default p-2 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
            Alternative revision
          </p>
          <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">
            {turn.alternativeRevision}
          </p>
          <button
            type="button"
            onClick={() => onUseAlternative(turn.alternativeRevision!)}
            className="text-[10px] font-semibold text-[#09090B] bg-[#FACC15] hover:bg-[#EAB308] px-2 py-0.5 rounded-md transition-colors"
          >
            Use this instead
          </button>
        </div>
      )}
    </div>
  );
}

/** Free-form follow-up input. Enter sends; Shift+Enter newline. Cleared
 *  on send. Disabled while a follow-up call is in flight. */
function FollowUpInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (question: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };
  return (
    <div className="pt-2 flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        disabled={disabled}
        placeholder="Ask me anything about this draft…"
        className="flex-1 min-w-0 text-[11px] text-primary placeholder:text-muted bg-surface border border-default rounded-md px-2 py-1.5 focus:outline-none focus:border-[#FACC15]/40 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send follow-up question"
        className="flex items-center justify-center w-7 h-7 rounded-md bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-30 disabled:cursor-not-allowed text-[#09090B] transition-colors"
      >
        <Send className="w-3 h-3" aria-hidden />
      </button>
    </div>
  );
}
