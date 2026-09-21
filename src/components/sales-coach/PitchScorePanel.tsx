"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Gauge, AlertTriangle, Info } from "lucide-react";
import { PitchDetail } from "./PitchDetail";
import { ScoringRubricSheet } from "./ScoringRubricSheet";
import type { StoredPitch } from "@/lib/coach/pitchScore/readPitchScore";

/**
 * The Pitch Score, on the session it came from.
 *
 * Sits BESIDE the existing dissect rather than replacing it — the build guide is explicit that
 * "the letter grade and skill scores stay as they are; the Pitch Score runs beside them."
 *
 * WHAT THIS COMPONENT IS REALLY FOR: making every state of the scoring pipeline legible. The
 * engine has four distinct failure modes and they mean different things to the person looking at
 * the screen — "your recording has no rep speech" is something the rep can fix by recording again,
 * and "the scorer returned nothing" is ours. Collapsing them into one "Something went wrong" would
 * undo the entire reason generatePitchScore returns a discriminated union instead of a zero.
 *
 * So there are five states and no shared error box: idle-unscored, scoring, failed (with the
 * route's own reason), scored, and read-failed. None of them is an empty state that looks like a
 * real answer.
 */

type State =
  | { kind: "loading" }
  | { kind: "unscored" }
  | { kind: "scoring" }
  | { kind: "failed"; message: string; retryable: boolean }
  | { kind: "scored"; pitch: StoredPitch };

const ENDPOINT = "/api/coach/sales-session/pitch-score";

export function PitchScorePanel({
  sessionId,
  /** False for a huddle or a meeting — those are not graded against the pitch rubric. */
  scorable = true,
  onSeek,
}: {
  sessionId: string;
  scorable?: boolean;
  onSeek?: (seconds: number) => void;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [rubricOpen, setRubricOpen] = useState(false);
  const [disputing, setDisputing] = useState<{ itemId?: string; timestampS?: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        // A failed READ is not an unscored pitch. Showing "Not scored yet" here would invite the
        // rep to spend an LLM call re-scoring a pitch that is already scored and simply unreadable.
        setState({
          kind: "failed",
          message: "Could not load this pitch's score.",
          retryable: true,
        });
        return;
      }
      const body = (await res.json()) as { pitch: StoredPitch | null };
      setState(body.pitch ? { kind: "scored", pitch: body.pitch } : { kind: "unscored" });
    } catch {
      setState({ kind: "failed", message: "Could not load this pitch's score.", retryable: true });
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const score = async () => {
    setState({ kind: "scoring" });
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; failure?: string };
      if (!res.ok) {
        setState({
          // The route's own message, not a generic one — it is the only thing that distinguishes
          // "nothing to grade" from "our scorer broke".
          kind: "failed",
          message: body.error ?? "This pitch could not be scored.",
          // no_agent_turns will not change on a retry; the rest might.
          retryable: body.failure !== "no_agent_turns",
        });
        return;
      }
      await load();
    } catch {
      setState({ kind: "failed", message: "This pitch could not be scored.", retryable: true });
    }
  };

  if (!scorable) return null;

  return (
    <section className="rounded-2xl border border-default bg-base p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Gauge className="w-4 h-4 text-brand" aria-hidden />
          Pitch Score
        </h2>
        <button
          type="button"
          onClick={() => setRubricOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          <Info className="w-3.5 h-3.5" aria-hidden />
          How points work
        </button>
      </header>

      {state.kind === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      )}

      {state.kind === "unscored" && (
        <div>
          <p className="text-xs text-secondary leading-relaxed">
            This pitch hasn&apos;t been scored yet. Scoring grades every element of the rubric
            against the recording and shows you the moment behind each one.
          </p>
          <button
            type="button"
            onClick={score}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-ember-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-ember-500"
          >
            <Gauge className="w-4 h-4" aria-hidden />
            Score this pitch
          </button>
        </div>
      )}

      {state.kind === "scoring" && (
        <p className="flex items-center gap-2 text-xs text-secondary">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Grading against the rubric — this takes a few seconds.
        </p>
      )}

      {state.kind === "failed" && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-start gap-2 text-xs text-primary">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            {/* The route's reason, verbatim. A generic message here is the failure this whole
                pipeline was designed against. */}
            <span>{state.message}</span>
          </p>
          {state.retryable && (
            <button
              type="button"
              onClick={score}
              className="mt-2 text-[11px] font-semibold text-brand hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {state.kind === "scored" && (
        <PitchDetail
          pitch={state.pitch}
          {...(onSeek ? { onSeek } : {})}
          onDispute={(item) => setDisputing(item)}
        />
      )}

      {rubricOpen && <ScoringRubricSheet onClose={() => setRubricOpen(false)} />}
      {disputing && state.kind === "scored" && (
        <DisputeSheet
          pitchId={state.pitch.id}
          item={disputing}
          onClose={() => setDisputing(null)}
        />
      )}
    </section>
  );
}

/**
 * The dispute form.
 *
 * Deliberately says what happens next and what does NOT: filing one does not change the score.
 * A rep who believes complaining re-scores the pitch will file more of them and trust the number
 * less, and the manager gets a queue instead of a signal.
 */
function DisputeSheet({
  pitchId,
  item,
  onClose,
}: {
  pitchId: string;
  item: { itemId?: string; timestampS?: number };
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"sent" | "failed" | null>(null);

  const send = async () => {
    if (!note.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${ENDPOINT}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchId, note: note.trim(), ...item }),
      });
      // Only a confirmed 200 says "sent". Telling a rep their dispute was filed when it was not
      // is worse than an error they can retry — they stop asking and the grade stands unchallenged.
      setResult(res.ok ? "sent" : "failed");
    } catch {
      setResult("failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dispute a score"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-base border border-default sm:rounded-2xl rounded-t-2xl p-5"
      >
        <h3 className="text-sm font-semibold text-primary">Dispute a score</h3>
        <p className="mt-1 text-[11px] text-muted leading-relaxed">
          {item.itemId ? `About ${item.itemId}. ` : ""}
          This goes to your manager with the timestamp. It does not change the score — a manager
          reviews it and any change they make is logged.
        </p>

        {result === "sent" ? (
          <>
            <p className="mt-4 text-xs text-primary">Sent. Your manager will see it with the moment attached.</p>
            <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl border border-default px-4 py-2 text-sm font-semibold text-primary">
              Done
            </button>
          </>
        ) : (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={4}
              aria-label="What was wrong with this score?"
              placeholder="What did the scorer get wrong?"
              className="mt-3 w-full rounded-xl border border-default bg-surface p-3 text-sm text-primary"
            />
            {result === "failed" && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                That didn&apos;t send. Nothing was recorded — please try again.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-default px-4 py-2 text-sm font-semibold text-primary">
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!note.trim() || sending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-ember-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-ember-500 disabled:opacity-50"
              >
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
