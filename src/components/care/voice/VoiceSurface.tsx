"use client";

import { Loader2, Mic, MicOff, PhoneOff, RefreshCw, Volume2 } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * VoiceSurface — phone-call shape. Phase 9 rewrite per user
 * feedback: the original push-to-talk surface was a walkie-
 * talkie, not a phone call. The new surface is "hands-free call":
 * customer just talks; VAD detects end of turn; Jeff replies;
 * loop continues until hang-up.
 *
 * §A14 multi-state UI — six phases each with a distinct
 * affordance:
 *   idle         — not currently used inside the surface; the
 *                  surface only renders when voiceMode=true.
 *                  Listed for type completeness.
 *   connecting   — "Connecting..." while mic permission resolves
 *   listening    — pulsing mic ring, "Just start talking" hint
 *   processing   — spinner, "Working on a reply..."
 *   speaking     — animated volume icon, "Jeff is speaking"
 *   error        — caller renders error string above this
 *                  surface; surface itself shows hang-up so
 *                  customer can try again
 *
 * The hang-up button (red, phone-off icon) is always visible
 * while the surface is mounted — clicking it ends the call.
 * Per §A18 the label invites: "End call" — descriptive, not
 * negative.
 */
export type VoicePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "error"
  // Back-compat with the push-to-talk implementation. Treated
  // as "processing" in the render switch.
  | "recording"
  | "transcribing"
  | "thinking";

export function VoiceSurface({
  phase,
  accent,
  transcript,
  permissionDeniedSteps,
  onRetry,
  onEnd,
}: {
  phase: VoicePhase;
  accent: string;
  transcript: string | null;
  /** When set, the surface renders the mic-permission help panel
   *  instead of the call status. Each string is a step. */
  permissionDeniedSteps?: string[] | null;
  /** Customer clicked "Try again" inside the help panel. */
  onRetry?: () => void;
  /** Customer ended the call. */
  onEnd: () => void;
}) {
  // ─── Permission-denied help panel ───────────────────────────
  // Highest priority — when permission is denied we don't render
  // call states at all; we render the recovery instructions so
  // the customer knows what to do.
  if (permissionDeniedSteps && permissionDeniedSteps.length > 0) {
    return (
      <div className="border-t border-default px-4 py-4 bg-surface/40 max-h-[70dvh] overflow-y-auto">
        <div className="flex items-start gap-2 mb-3">
          <MicOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-primary mb-1">
              Microphone is blocked
            </p>
            <p className="text-[11px] text-secondary leading-relaxed">
              Your browser is blocking mic access for this site. Here&apos;s
              how to enable it in your browser:
            </p>
          </div>
        </div>
        <ol className="space-y-1.5 text-[11px] text-secondary leading-relaxed pl-1 mb-3">
          {permissionDeniedSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold text-primary shrink-0">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          {onRetry && (
            <LearningHint
              category="C.A.R.E · Voice"
              title="Try again"
              whatItIs="Re-requests microphone permission after the visitor has changed their browser's mic setting, without making them reload the page."
              why="A blocked mic is usually a two-step fix — the visitor flips the browser setting, then needs to re-ask. Forcing a full page reload here would drop the conversation they already started. This retries in place and keeps the thread."
              how="Follow the numbered steps above to unblock the mic in your browser, then click this. If it still fails, 'Back to typing' keeps the conversation going by text."
              principle="A recoverable error should offer the recovery, not just name the problem."
            >
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 text-[#09090B] px-3 py-1.5 rounded-md"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden />
              Try again
            </button>
            </LearningHint>
          )}
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary border border-default hover:border-strong px-3 py-1.5 rounded-md"
          >
            <PhoneOff className="w-3.5 h-3.5" aria-hidden />
            Back to typing
          </button>
        </div>
        <p className="text-[10px] text-muted italic mt-3">
          You can keep typing instead — Jeff will still hear you that way.
        </p>
      </div>
    );
  }

  // Map legacy push-to-talk phases onto the call shape so old
  // consumer code that hasn't been refactored yet still renders
  // sensibly.
  const normalized: "connecting" | "listening" | "processing" | "speaking" | "error" =
    phase === "connecting"
      ? "connecting"
      : phase === "listening"
        ? "listening"
        : phase === "speaking"
          ? "speaking"
          : phase === "error"
            ? "error"
            : "processing"; // recording/transcribing/thinking/processing/idle all collapse here

  const labelByPhase: Record<typeof normalized, string> = {
    connecting: "Connecting…",
    listening: "Just start talking — I'm listening",
    processing: "Working on a reply…",
    speaking: "Jeff is speaking",
    error: "Something went wrong. Try ending and calling again.",
  };

  return (
    <div className="border-t border-default px-4 py-5 bg-surface/40 flex flex-col items-center gap-4">
      {transcript && (normalized === "processing" || normalized === "speaking") && (
        <p className="text-[11px] text-muted italic text-center max-w-[280px]">
          You said: &ldquo;{transcript}&rdquo;
        </p>
      )}

      {/* Big circular status indicator — what's happening right now. */}
      <div
        style={{
          backgroundColor:
            normalized === "listening" ? accent : "transparent",
          borderColor: accent,
        }}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors ${
          normalized === "listening" ? "" : "bg-surface"
        }`}
      >
        {normalized === "connecting" || normalized === "processing" ? (
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: accent }}
            aria-hidden
          />
        ) : normalized === "speaking" ? (
          <Volume2
            className="w-8 h-8 animate-pulse text-[#09090B]"
            aria-hidden
          />
        ) : (
          <Mic
            className={`w-8 h-8 ${
              normalized === "listening" ? "text-[#09090B]" : "text-muted"
            }`}
            aria-hidden
          />
        )}
        {/* Listening: rippling outer ring so the customer can
            see the mic is hot, not just "static idle." */}
        {normalized === "listening" && (
          <span
            className="absolute inset-0 rounded-full border-2 animate-ping"
            style={{ borderColor: accent }}
            aria-hidden
          />
        )}
      </div>

      <p className="text-xs text-secondary text-center max-w-[260px]">
        {labelByPhase[normalized]}
      </p>

      {/* Hang up — always available. */}
      <LearningHint
        category="C.A.R.E · Voice"
        title="End call"
        whatItIs="Hangs up the live voice conversation and returns the visitor to the text composer. Always visible while a call is active."
        why="A live mic is a privacy surface, so ending must be one obvious tap that's never hidden behind a menu or a phase change. The label says what it does — 'End call' — rather than a bare red X the visitor has to guess at."
        how="Tap to hang up. The mic stops immediately. Anything already transcribed stays in the conversation; the visitor can keep typing from there."
        principle="Anything that keeps a microphone open needs an off switch you can't miss."
      >
      <button
        type="button"
        onClick={onEnd}
        aria-label="End call"
        className="inline-flex items-center gap-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full transition-colors"
      >
        <PhoneOff className="w-3.5 h-3.5" aria-hidden />
        End call
      </button>
      </LearningHint>
    </div>
  );
}
