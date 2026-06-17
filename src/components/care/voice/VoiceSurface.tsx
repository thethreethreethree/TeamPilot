"use client";

import { Loader2, Mic, Volume2 } from "lucide-react";

/**
 * VoiceSurface — Phase 9. Shared §A14 multi-state UI for the
 * real-time voice loop. Used by both customer-facing widgets:
 * CareEmbeddedWidget (white-label embed) and CareChatWidget
 * (elostate.com marketing page).
 *
 * Per §A13 (vocabulary-once): this surface lives in one place
 * so adding a third widget surface later means import, not
 * copy-paste.
 *
 * Six phases, each with a distinct affordance:
 *   idle         — large mic button "Press and hold to speak"
 *   recording    — pulsing red ring, "Listening… release to send"
 *   transcribing — spinner, "Transcribing…"
 *   thinking     — spinner, "Jeff is thinking…"
 *   speaking     — pulsing speaker icon, "Jeff is speaking"
 *   error        — idle visual but error string renders above
 *                  this surface (caller's responsibility)
 */
export type VoicePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export function VoiceSurface({
  phase,
  accent,
  transcript,
  onPress,
  onRelease,
  onExit,
}: {
  phase: VoicePhase;
  accent: string;
  transcript: string | null;
  onPress: () => void;
  onRelease: () => void;
  onExit: () => void;
}) {
  const labelByPhase: Record<VoicePhase, string> = {
    idle: "Press and hold to speak",
    recording: "Listening… release to send",
    transcribing: "Transcribing…",
    thinking: "Jeff is thinking…",
    speaking: "Jeff is speaking",
    error: "Press and hold to try again",
  };

  const buttonDisabled =
    phase === "transcribing" || phase === "thinking" || phase === "speaking";

  return (
    <div className="border-t border-default px-4 py-4 bg-surface/40 flex flex-col items-center gap-3">
      {transcript && phase !== "idle" && phase !== "recording" && (
        <p className="text-[11px] text-muted italic text-center max-w-[280px]">
          You said: &ldquo;{transcript}&rdquo;
        </p>
      )}
      <button
        type="button"
        onPointerDown={onPress}
        onPointerUp={onRelease}
        onPointerLeave={onRelease}
        onPointerCancel={onRelease}
        disabled={buttonDisabled}
        aria-label="Push to talk"
        style={{
          backgroundColor: phase === "recording" ? "#ef4444" : accent,
        }}
        className={`relative w-16 h-16 rounded-full text-[#09090B] flex items-center justify-center transition-transform disabled:opacity-50 ${
          phase === "recording" ? "scale-110" : "scale-100"
        }`}
      >
        {phase === "transcribing" || phase === "thinking" ? (
          <Loader2 className="w-7 h-7 animate-spin" aria-hidden />
        ) : phase === "speaking" ? (
          <Volume2 className="w-7 h-7 animate-pulse" aria-hidden />
        ) : (
          <Mic className="w-7 h-7" aria-hidden />
        )}
        {phase === "recording" && (
          <span
            className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping"
            aria-hidden
          />
        )}
      </button>
      <p className="text-xs text-secondary text-center">
        {labelByPhase[phase]}
      </p>
      <button
        type="button"
        onClick={onExit}
        className="text-[10px] text-muted hover:text-primary underline-offset-2 hover:underline"
      >
        Back to typing
      </button>
    </div>
  );
}
