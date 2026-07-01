import { useEffect, useRef, useState } from "react";

/**
 * Live Sales Coach — earpiece TAP control (build 5). Bluetooth earbuds (AirPods
 * etc.) map taps to standard media keys; the browser surfaces those via the
 * MediaSession API. We map them to rep actions so the rep controls the coach
 * hands-free (§3.3 — the rep is the participant, choosing when to invoke).
 *
 * HARD LIMITS (§3.4 — cannot be verified without hardware, stated plainly):
 *   - The browser only receives standard events (play/pause/nexttrack/
 *     previoustrack), NOT "single/double/triple tap" — the EARBUD decides
 *     which tap maps to which key. So the tap-to-action mapping is
 *     DEVICE-DEPENDENT and best-effort.
 *   - MediaSession requires active media playback, so we keep a SILENT looping
 *     audio element alive while coaching. This is a hack and may interact with
 *     the cue TTS audio path.
 *   - Support + behaviour vary by browser/OS/earbud. `supported` only reports
 *     that the API exists, NOT that taps will actually reach us.
 */

/** Build a tiny silent WAV as an object URL — a media element must be PLAYING
 *  for a MediaSession to exist; a silent loop does that without audible sound. */
function makeSilentWavUrl(): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * 0.2); // 0.2s, looped
  const dataSize = numSamples; // 8-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (1 byte/sample)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits/sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128); // 8-bit silence
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

// F1 (audit 2026-07-01) — debounce the coach-me tap: earbuds can emit stray/
// repeated media events, and requestCue bypasses the cue cooldown, so without
// this a flurry of taps could stack on-demand cues (§5 cost / §3.3 over-cue).
// cueInFlightRef already blocks the concurrent burst; this closes the
// sequential/laggy residual.
const TAP_DEBOUNCE_MS = 2000;

export function useTapControls(args: {
  active: boolean;
  onCoachMe: () => void; // a tap → "coach me now"
  onToggleQuiet: () => void; // triple-tap → quiet toggle
}): { supported: boolean; lastTapAt: number } {
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "mediaSession" in navigator
  );
  // Timestamp of the last tap the app ACTUALLY received — lets the UI show a
  // "tap received" confirmation so the rep can VERIFY taps reach us (separate
  // from whether a cue then fires). 0 = none yet.
  const [lastTapAt, setLastTapAt] = useState(0);
  // Keep the latest callbacks without re-running the effect on every render.
  const cbRef = useRef(args);
  cbRef.current = args;
  const lastTapRef = useRef(0); // F1 — last coach-me tap (ms epoch)

  useEffect(() => {
    if (!args.active || !supported) return;
    const url = makeSilentWavUrl();
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0;
    void audio.play().catch(() => {});

    const ms = navigator.mediaSession;
    const keepAlive = () => {
      try {
        ms.playbackState = "playing";
      } catch {
        /* no-op */
      }
      void audio.play().catch(() => {});
    };
    try {
      ms.metadata = new MediaMetadata({
        title: "Sales Coach",
        artist: "Live coaching",
      });
      ms.playbackState = "playing";
      // Any common tap (single/double) → coach me; keep the session alive so a
      // "pause" gesture doesn't tear it down. F1 — debounced: a tap within
      // TAP_DEBOUNCE_MS keeps the session alive but does NOT re-fire the cue.
      const coachMe = () => {
        const now = Date.now();
        setLastTapAt(now); // record EVERY received tap (even if debounced)
        if (now - lastTapRef.current < TAP_DEBOUNCE_MS) {
          keepAlive();
          return;
        }
        lastTapRef.current = now;
        cbRef.current.onCoachMe();
        keepAlive();
      };
      ms.setActionHandler("play", coachMe);
      ms.setActionHandler("pause", coachMe);
      ms.setActionHandler("nexttrack", coachMe);
      // Triple-tap (previoustrack on many earbuds) → quiet toggle.
      ms.setActionHandler("previoustrack", () => {
        setLastTapAt(Date.now());
        cbRef.current.onToggleQuiet();
        keepAlive();
      });
    } catch {
      /* setActionHandler / MediaMetadata unsupported — supported stays true but
         taps simply won't arrive; the UI legend is honest about that. */
    }

    return () => {
      try {
        (["play", "pause", "nexttrack", "previoustrack"] as const).forEach(
          (a) => navigator.mediaSession.setActionHandler(a, null)
        );
        navigator.mediaSession.playbackState = "none";
      } catch {
        /* no-op */
      }
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [args.active, supported]);

  return { supported, lastTapAt };
}
