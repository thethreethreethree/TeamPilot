"use client";

import { Loader2, Mic, PhoneOff, Volume2 } from "lucide-react";

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
  onEnd,
}: {
  phase: VoicePhase;
  accent: string;
  transcript: string | null;
  /** Customer ended the call. */
  onEnd: () => void;
  // Back-compat props from the push-to-talk surface. Ignored
  // in the call-shape implementation but kept so existing
  // callers don't break during the migration.
  onPress?: () => void;
  onRelease?: () => void;
  onExit?: () => void;
}) {
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
      <button
        type="button"
        onClick={onEnd}
        aria-label="End call"
        className="inline-flex items-center gap-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full transition-colors"
      >
        <PhoneOff className="w-3.5 h-3.5" aria-hidden />
        End call
      </button>
    </div>
  );
}
