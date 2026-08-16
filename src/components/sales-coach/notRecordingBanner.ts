import type { LiveStatus } from "@/lib/coach/v5/useLiveCoaching";

/**
 * Copy for the live-coaching "not recording" banner — extracted as a pure function so the
 * honesty-critical branch is unit-tested (audit 2026-08-16, finding #1).
 *
 * The trap it fixes: when the STT feed drops mid-call, `status` is "error" BUT the MediaRecorder
 * keeps capturing audio (`audioCapturing` stays true) — the call is still being recorded and is
 * recoverable. The banner must NOT tell the rep "nothing is being captured" in that case, or they
 * abandon a recoverable call (§3.4 — never show a worse state than reality). Only a real capture
 * stop (mic-denied / setup failure, where `stop()` ran and `audioCapturing` is false) may say so.
 */
export function notRecordingBanner(
  status: LiveStatus,
  audioCapturing: boolean,
  error: string | null
): { title: string; body: string } {
  if (status === "error") {
    if (audioCapturing) {
      return {
        title: "Live transcription dropped — but your audio is still recording.",
        body: "Tap Stop to save the call — you can recover the transcript afterward. (Live cues are paused until the feed reconnects.)",
      };
    }
    return {
      title: "Recording stopped — nothing is being captured.",
      body: error ?? "Tap Start live coaching before you begin.",
    };
  }
  return {
    title: "You're not recording yet.",
    body: "Tap Start live coaching before you begin.",
  };
}
