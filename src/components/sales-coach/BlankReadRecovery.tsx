"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionRecordingUpload } from "@/components/sales-coach/SessionRecordingUpload";
import { shouldOfferBlankReadRecovery } from "@/lib/coach/v5/blankReadRecovery";
import type { CaptureGap } from "@/lib/coach/v5/captureGap";
import { transcriptVoices, voiceLineFromRow, type TranscriptVoice } from "@/lib/coach/v5/transcriptVoices";

/* Moved out of after-pitch/page.tsx on 2026-10-08, unchanged, so it can be render-tested: a Next page file may
   export only its page. */
/* ─── BlankReadRecovery (founder 2026-08-13; automatic recovery 2026-08-14) ───────────────────────────
   A one-sided session (one voice missed by live STT/attribution) still has COMPOSITE signal (moments /
   cue-loop), so the whole-summary-empty recovery never renders — the rep is left with a blank "Your read".

   AUTOMATIC first (2026-08-14): for the customer-missing gap the page auto-fires the server /auto-recover,
   which re-diarizes the saved audio cleanly, auto-assigns the agent, and rebuilds the read — no rep action.
   While that's in flight this shows a working state. The MANUAL one-tap card below is the FALLBACK, shown
   only when auto-recover resolved WITHOUT recovering (couldn't separate the voices / already attempted /
   failed), or for the agent-missing direction auto-recover doesn't own.

   HONESTY GATE (§3.4): visibility + the missing-side wording are driven by the capture-gap DIRECTION
   (detectCaptureGap), never a blank narrative alone — a two-sided STARVED read (no capture gap) must never
   see a re-transcribe affordance, because re-transcribing reproduces the same transcript and the copy would
   assert a capture failure that didn't happen. shouldOfferBlankReadRecovery is pure + detection-tested. */
export function BlankReadRecovery({
  sessionId,
  gap,
  hasSavedRecording,
  autoRecovering,
  autoRecoverResolved,
  autoRecoverOutcome,
  onRecovered,
}: {
  sessionId: string;
  gap: CaptureGap;
  hasSavedRecording: boolean;
  autoRecovering: boolean;
  autoRecoverResolved: boolean;
  autoRecoverOutcome: string | null;
  onRecovered: () => void;
}) {
  /*
    IS THE TRANSCRIPT ALREADY HERE, JUST UNATTRIBUTED?

    Recovery now saves a dropped call's words as `unknown` when it cannot confidently say
    which voice is the rep. Those words are in the database, with their timing. The card
    below would have offered to RE-TRANSCRIBE the audio to fix that — a second speech-to-text
    charge, on a recording of up to 42 minutes, to obtain words we already have. And its copy
    would have been wrong: the read is not blank, it is unattributed.

    `null` while unknown, so nothing is asserted before the answer arrives. Hooks run
    unconditionally and the branching happens in the render below.
  */
  const [unlabelled, setUnlabelled] = useState<boolean | null>(null);
  // Two or more voices on an unattributed call (2026-10-08): ask which one is the rep, never "is this you?" for all.
  const [voices, setVoices] = useState<TranscriptVoice[] | null>(null);
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/coach/sales-session/${sessionId}/segments`);
        if (!r.ok) return;
        const d = (await r.json()) as {
          segments?: { speaker?: string; text?: string; source?: string | null; speaker_cluster?: string | null }[];
        };
        const segs = d.segments ?? [];
        // Words present AND every one of them unattributed. A transcript with even one real
        // turn already has an answer, and an empty one has nothing to ask about.
        if (!cancelled) {
          setUnlabelled(segs.length > 0 && segs.every((x) => x.speaker === "unknown"));
          setVoices(transcriptVoices(segs.map(voiceLineFromRow)));
        }
      } catch {
        /* stays null — the existing card behaviour is the honest fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const answer = useCallback(
    async (reply: { mine: boolean } | { agentCluster: string }) => {
      setAnswering(true);
      setAnswerError(null);
      try {
        const r = await fetch(`/api/coach/sales-session/${sessionId}/attribute-unlabelled`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reply),
        });
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          setAnswerError(d.error ?? "Couldn't save that — your transcript is unchanged.");
          return;
        }
        onRecovered();
      } catch {
        setAnswerError("Couldn't reach the server — your transcript is unchanged.");
      } finally {
        setAnswering(false);
      }
    },
    [sessionId, onRecovered]
  );

  // TWO VOICES, NOT ONE (2026-10-08). The recovery heard two voices and could not tell which is the rep. Asking
  // "is this you?" would label every line one way and score the customer's words as the rep's, so each voice is
  // shown with a line of its own and the rep picks theirs.
  if (unlabelled === true && voices) {
    return (
      <section className="rounded-2xl border border-ember-400/30 bg-ember-400/[0.05] p-4 space-y-3">
        <div>
          <p className="text-xs text-primary font-medium">Which of these voices is you?</p>
          <p className="text-[11px] text-muted leading-relaxed mt-1">
            We recovered what was said on this call and heard {voices.length} voices, but we can&apos;t tell which
            one is yours. Read a line from each and pick yours — the coaching read is then built from your side
            only. This is a one-time answer.
          </p>
        </div>
        <ul className="space-y-2">
          {voices.map((v, i) => (
            <li key={v.cluster} className="rounded-lg border border-default bg-surface/60 p-3 space-y-2">
              <p className="text-[11px] text-muted">
                Voice {i + 1} · {v.lines} {v.lines === 1 ? "line" : "lines"}
              </p>
              <p className="text-xs text-primary leading-relaxed">
                {v.sample ? <>&ldquo;{v.sample}&rdquo;</> : <span className="text-muted">No words, only sounds.</span>}
              </p>
              <button
                type="button"
                onClick={() => void answer({ agentCluster: v.cluster })}
                disabled={answering}
                className="min-h-11 rounded-lg bg-ember-400/15 px-4 text-xs font-medium text-primary hover:bg-ember-400/25 disabled:opacity-50"
              >
                {answering ? "Saving…" : "This one is me"}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void answer({ mine: false })}
          disabled={answering}
          className="min-h-11 rounded-lg border border-default px-4 text-xs font-medium text-secondary hover:bg-surface disabled:opacity-50"
        >
          None of these is me
        </button>
        {answerError ? <p className="text-[11px] text-rose-700 dark:text-rose-300">{answerError}</p> : null}
      </section>
    );
  }

  // THE WORDS ARE ALREADY HERE. Ask the one question that unlocks them, rather than paying
  // to transcribe the same audio twice.
  if (unlabelled === true) {
    return (
      <section className="rounded-2xl border border-ember-400/30 bg-ember-400/[0.05] p-4 space-y-3">
        <div>
          <p className="text-xs text-primary font-medium">Whose voice is on this recording?</p>
          <p className="text-[11px] text-muted leading-relaxed mt-1">
            We recovered what was said on this call, but only one voice came through and we
            can&apos;t tell whose it is. Say which, and the coaching read is built from it —
            nothing is re-recorded and nothing is lost either way.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void answer({ mine: true })}
            disabled={answering}
            className="min-h-11 rounded-lg bg-ember-400/15 px-4 text-xs font-medium text-primary hover:bg-ember-400/25 disabled:opacity-50"
          >
            {answering ? "Saving…" : "That’s me"}
          </button>
          <button
            type="button"
            onClick={() => void answer({ mine: false })}
            disabled={answering}
            className="min-h-11 rounded-lg border border-default px-4 text-xs font-medium text-secondary hover:bg-surface disabled:opacity-50"
          >
            That&apos;s the customer
          </button>
        </div>
        {answerError ? <p className="text-[11px] text-rose-700 dark:text-rose-300">{answerError}</p> : null}
      </section>
    );
  }

  // Automatic recovery in flight — a working state, not the manual tap card.
  if (autoRecovering) {
    return (
      <section className="rounded-2xl border border-ember-400/30 bg-ember-400/[0.05] p-4">
        <p className="text-xs text-primary font-medium">Recovering your read from the recording…</p>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          One side of the call wasn&apos;t captured live, so we&apos;re re-transcribing the saved audio to rebuild
          the full read. This only takes a moment.
        </p>
      </section>
    );
  }
  // Auto-recover found only ONE voice in the recording — re-transcribing it again would reproduce the same
  // one-sided result, so DON'T offer the re-transcribe card (a false-promise loop). Say honestly what happened
  // (§3.4). This is the terminal the API's distinct "still-one-sided" status exists to enable.
  if (autoRecoverOutcome === "still-one-sided") {
    return (
      <section className="rounded-2xl border border-default bg-surface/60 p-4">
        <p className="text-xs text-primary font-medium">Only one side of this call was recorded.</p>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          The saved audio only picked up one voice, so there&apos;s no second side to recover — the scores and
          focus below are built from what was captured. For the full written read next time, make sure both
          voices reach the mic.
        </p>
      </section>
    );
  }
  if (!shouldOfferBlankReadRecovery({ gap, hasSavedRecording, autoRecoverResolved })) return null;
  // Name the missing side honestly (never assert the wrong one).
  const missing =
    gap === "agent-missing"
      ? "your side of the call wasn't transcribed live"
      : "the other side of the call wasn't captured live";
  return (
    <section className="rounded-2xl border border-ember-400/30 bg-ember-400/[0.05] p-4 space-y-3">
      <div>
        <p className="text-xs text-primary font-medium">Your written read didn&apos;t generate for this call.</p>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          The full written read came back blank because {missing} — so the breakdown below is built from only
          one side. Your audio <span className="text-secondary">was saved</span>, so recover the full read from
          the recording:
        </p>
      </div>
      <SessionRecordingUpload
        sessionId={sessionId}
        onLabeled={onRecovered}
        hasSavedRecording={hasSavedRecording}
        autoRetranscribe={hasSavedRecording}
      />
    </section>
  );
}
