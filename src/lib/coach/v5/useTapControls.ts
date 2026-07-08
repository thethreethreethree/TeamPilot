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

// Hardware double-delivery guard (NOT a usage restriction). The OS/browser can
// deliver ONE physical media-key press as two events; this swallows the
// duplicate so a single gesture fires its action once. It replaces the old 2s
// "quiet" debounce that blocked fast re-activation — dropped 2026-07-03 so the
// rep can activate without delay (§3.3, the rep asked; the engine's auto-cue
// cooldown is already bypassed on-demand, so nothing else gates manual use).
const DEDUP_MS = 250;

export function useTapControls(args: {
  active: boolean;
  onAgentSpeaking: () => void; // single tap (play/pause) → toggle "I'm speaking"
  onCoachMe: () => void; // double tap (nexttrack) → activate the coach
  onToggleQuiet: () => void; // triple tap (previoustrack) → quiet toggle
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
  // Per-action last-fire (ms epoch) for the dedup guard — separate so toggling
  // "speaking" never swallows an activation and vice-versa.
  const lastSpeakingRef = useRef(0);
  const lastCoachRef = useRef(0);
  const lastQuietRef = useRef(0);

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
      // Fire an action once per physical gesture (dedup guard), always keeping
      // the media session alive so a "pause" gesture doesn't tear it down.
      const fire = (ref: { current: number }, cb: () => void) => {
        const now = Date.now();
        setLastTapAt(now); // record EVERY received tap (even a deduped one)
        if (now - ref.current < DEDUP_MS) {
          keepAlive();
          return;
        }
        ref.current = now;
        cb();
        keepAlive();
      };
      // Single tap (play/pause on most earbuds) → toggle "agent is speaking".
      const onSpeaking = () => fire(lastSpeakingRef, cbRef.current.onAgentSpeaking);
      ms.setActionHandler("play", onSpeaking);
      ms.setActionHandler("pause", onSpeaking);
      // Double tap (nexttrack) → activate the coach — no delay, fires instantly.
      ms.setActionHandler("nexttrack", () =>
        fire(lastCoachRef, cbRef.current.onCoachMe)
      );
      // Triple-tap (previoustrack on many earbuds) → quiet toggle. Must go through
      // fire() like the others (audit 2026-07-09): without the dedup guard, the same
      // hardware double-delivery this file documents (a single physical press → two
      // events) toggled quiet on→off, so the triple-tap did nothing.
      ms.setActionHandler("previoustrack", () =>
        fire(lastQuietRef, cbRef.current.onToggleQuiet)
      );
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
