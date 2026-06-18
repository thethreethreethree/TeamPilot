"use client";

import { useEffect, useState } from "react";
import { BookOpen, Loader2, MessageCircle, Send } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type {
  CoachAnalysisRequest,
  CoachAnalysisResponse,
  CoachContextPayload,
  CoachFollowUpResponse,
} from "@/lib/coach/v5/types";

/**
 * ReviewSentMessageModal — Coach v5.0 retrospective coaching surface.
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md §1.5.
 *
 * Opens when the user clicks "Review with Coach" on one of their own
 * sent messages (from the Encouragement System indicator). The Coach
 * reads the message AS IT SITS in the conversation — with any messages
 * that came after — and teaches retrospectively. The user can't accept
 * a rewrite (the message is already out), but they get the lesson, which
 * is the growth contract Coach exists to serve.
 *
 * The flow:
 *  1. Modal opens with the sent message displayed at the top
 *  2. Coach analyzes in mode "review_sent"
 *  3. Shows whyContext + whySentence + named principle (no accept button —
 *     teaching only)
 *  4. Conversation starters are clickable; free-form input available
 *  5. User can ask follow-ups indefinitely, then close
 */

type Turn =
  | { role: "user"; content: string }
  | { role: "coach"; content: string };

type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; analysis: CoachAnalysisResponse; turns: Turn[]; followingUp: boolean; latestStarters: string[] }
  | { kind: "error"; message: string };

export function ReviewSentMessageModal({
  sentMessage,
  contextPayload,
  onClose,
}: {
  sentMessage: string;
  contextPayload: CoachContextPayload;
  onClose: () => void;
}) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    const request: CoachAnalysisRequest = {
      mode: "review_sent",
      draft: sentMessage,
      contextType: "chat_message",
      contextPayload,
    };

    void (async () => {
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
          setState({
            kind: "error",
            message: "Coach is in §3.4 control window — guidance temporarily unavailable",
          });
          return;
        }
        setState({
          kind: "ready",
          analysis: data.response,
          turns: [],
          followingUp: false,
          latestStarters: data.response.conversationStarters,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Coach call failed",
        });
      }
    })();

    return () => controller.abort();
  }, [sentMessage, contextPayload]);

  const sendFollowUp = async (userQuestion: string) => {
    if (state.kind !== "ready") return;
    const question = userQuestion.trim();
    if (!question) return;

    const userTurn: Turn = { role: "user", content: question };
    const turnsWithUser = [...state.turns, userTurn];
    setState({ ...state, turns: turnsWithUser, followingUp: true });

    try {
      const res = await fetch("/api/coach/v5/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: sentMessage,
          contextType: "chat_message",
          contextPayload,
          priorTurns: turnsWithUser.map((t) => ({ role: t.role, content: t.content })),
          userQuestion: question,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        const errorTurn: Turn = {
          role: "coach",
          content: errBody?.error ?? `Coach unavailable (HTTP ${res.status})`,
        };
        setState((curr) =>
          curr.kind === "ready"
            ? { ...curr, turns: [...turnsWithUser, errorTurn], followingUp: false }
            : curr
        );
        return;
      }

      const data = (await res.json()) as {
        response?: CoachFollowUpResponse;
        suppressed?: boolean;
      };

      if (data.suppressed || !data.response) {
        setState((curr) =>
          curr.kind === "ready"
            ? {
                ...curr,
                turns: [
                  ...turnsWithUser,
                  {
                    role: "coach",
                    content: "Coach is in §3.4 control window — guidance temporarily suppressed.",
                  },
                ],
                followingUp: false,
              }
            : curr
        );
        return;
      }

      const coachTurn: Turn = { role: "coach", content: data.response.reply };
      setState((curr) =>
        curr.kind === "ready"
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
        curr.kind === "ready"
          ? { ...curr, turns: [...turnsWithUser, errorTurn], followingUp: false }
          : curr
      );
    }
  };

  return (
    <Modal open onClose={onClose} title="Reviewing with Coach" size="lg">
      <div className="space-y-3">
        {/* The sent message — pinned at the top so the user knows what
            the Coach is reading. Quoted treatment to signal "this is
            what you wrote." */}
        <div className="rounded-lg bg-surface border border-default p-3">
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted mb-1">
            What you sent
          </p>
          <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap break-words italic">
            &ldquo;{sentMessage}&rdquo;
          </p>
        </div>

        {state.kind === "loading" && (
          <div className="flex items-center gap-2 text-[11px] text-muted uppercase tracking-widest font-mono">
            <Loader2 className="w-3 h-3 text-brand/60 animate-spin" aria-hidden />
            Sitting with what you wrote…
          </div>
        )}

        {state.kind === "error" && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2">
            <p className="text-xs text-red-300/80">{state.message}</p>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            {state.analysis.affirmation && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                <p className="text-xs text-emerald-200 leading-relaxed">
                  {state.analysis.affirmation}
                </p>
              </div>
            )}

            {state.analysis.improvement && (
              <>
                <div className="rounded-lg bg-ember-400/10 border border-ember-400/30 p-2.5 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
                    Here&apos;s what I&apos;m seeing
                  </p>
                  <p className="text-xs text-primary leading-relaxed">
                    {state.analysis.improvement.whyContext}
                  </p>
                </div>

                <div className="rounded-lg bg-surface border border-default p-2.5 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
                    Next time you might try
                  </p>
                  <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                    {state.analysis.improvement.suggestedRevision}
                  </p>
                  <p className="text-[11px] text-secondary leading-relaxed border-l-2 border-ember-400/40 pl-2 italic">
                    {state.analysis.improvement.whySentence}
                  </p>
                  <p className="text-[10px] text-muted font-mono uppercase tracking-wider">
                    {state.analysis.improvement.principleCited.name}
                    {" — "}
                    {state.analysis.improvement.principleCited.book}
                    {state.analysis.improvement.secondaryPrinciple && (
                      <>
                        {" + "}
                        {state.analysis.improvement.secondaryPrinciple.name}
                      </>
                    )}
                  </p>
                </div>
              </>
            )}

            {state.turns.length > 0 && (
              <div className="pt-2 border-t border-ember-400/15 space-y-2">
                {state.turns.map((turn, i) =>
                  turn.role === "user" ? (
                    <div key={i} className="flex items-start gap-2 pl-4">
                      <MessageCircle className="w-3 h-3 text-muted mt-0.5 flex-shrink-0" aria-hidden />
                      <p className="text-[11px] text-muted leading-relaxed italic flex-1 break-words">
                        {turn.content}
                      </p>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2">
                      <BookOpen className="w-3 h-3 text-brand mt-0.5 flex-shrink-0" aria-hidden />
                      <p className="text-xs text-primary leading-relaxed flex-1 whitespace-pre-wrap break-words">
                        {turn.content}
                      </p>
                    </div>
                  )
                )}
                {state.followingUp && (
                  <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-widest font-mono">
                    <Loader2 className="w-3 h-3 text-brand/60 animate-spin" aria-hidden />
                    Coach is thinking…
                  </div>
                )}
              </div>
            )}

            {!state.followingUp && state.latestStarters.length > 0 && (
              <div className="pt-2 border-t border-ember-400/15">
                <p className="text-[10px] uppercase tracking-widest font-mono text-muted mb-1.5">
                  {state.turns.length === 0 ? "You could ask me" : "Or ask"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {state.latestStarters.slice(0, 3).map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => void sendFollowUp(q)}
                      className="text-[11px] text-left text-secondary hover:text-primary bg-surface hover:bg-ember-400/[0.08] border border-default rounded-full px-2.5 py-1 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ReviewInput
              disabled={state.followingUp}
              onSend={(q) => void sendFollowUp(q)}
            />
          </>
        )}

        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-muted hover:text-secondary px-2 py-1"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReviewInput({
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
        placeholder="Ask me anything about this message…"
        className="flex-1 min-w-0 text-[11px] text-primary placeholder:text-muted bg-surface border border-default rounded-md px-2 py-1.5 focus:outline-none focus:border-ember-400/40 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send follow-up question"
        className="flex items-center justify-center w-7 h-7 rounded-md bg-ember-400 hover:bg-ember-500 disabled:opacity-30 disabled:cursor-not-allowed text-[#09090B] transition-colors"
      >
        <Send className="w-3 h-3" aria-hidden />
      </button>
    </div>
  );
}
