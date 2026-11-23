"use client";

import { useEffect, type RefObject } from "react";

/**
 * Listen in the car / on the lock screen (2026-11-23; ledger F30.8 "Listen in the car"). While a recorded call is
 * playing, the phone's lock screen, a car's display (CarPlay / Android Auto via the browser) and Bluetooth controls show
 * the call and drive it: play, pause, back and forward 15 seconds, and seeking. Uses the standard Media Session API —
 * nothing to install; where a browser lacks it, this does nothing.
 *
 * Handlers are set when playback starts and cleared on unmount, so they never outlive the player (the live-coaching tap
 * controls, useTapControls, own the session on their own screen).
 */
export const SKIP_SECONDS = 15;

export function mediaActions(el: HTMLAudioElement): Partial<Record<MediaSessionAction, MediaSessionActionHandler>> {
  const clamp = (t: number) => Math.max(0, Number.isFinite(el.duration) ? Math.min(el.duration, t) : t);
  return {
    play: () => void el.play().catch(() => {}),
    pause: () => el.pause(),
    stop: () => el.pause(),
    seekbackward: (d) => {
      el.currentTime = clamp(el.currentTime - (d.seekOffset ?? SKIP_SECONDS));
    },
    seekforward: (d) => {
      el.currentTime = clamp(el.currentTime + (d.seekOffset ?? SKIP_SECONDS));
    },
    seekto: (d) => {
      if (typeof d.seekTime === "number") el.currentTime = clamp(d.seekTime);
    },
  };
}

/** `ready` changes when the audio element appears (players render it only once the recording's address is known). */
export function useCallMediaSession(audio: RefObject<HTMLAudioElement | null>, info: { title: string; artist?: string; ready: boolean }) {
  useEffect(() => {
    const el = audio.current;
    if (!el || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const actions = mediaActions(el);
    const onPlay = () => {
      try {
        if (typeof MediaMetadata !== "undefined") ms.metadata = new MediaMetadata({ title: info.title, artist: info.artist ?? "ELOSTATE call", album: "Recorded call" });
        for (const [a, h] of Object.entries(actions)) {
          try {
            ms.setActionHandler(a as MediaSessionAction, h ?? null);
          } catch {
            /* an action this browser doesn't support */
          }
        }
        ms.playbackState = "playing";
      } catch {
        /* Media Session is best-effort */
      }
    };
    const onPause = () => {
      try {
        ms.playbackState = "paused";
      } catch {
        /* best-effort */
      }
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      try {
        for (const a of Object.keys(actions)) ms.setActionHandler(a as MediaSessionAction, null);
        ms.metadata = null;
        ms.playbackState = "none";
      } catch {
        /* best-effort */
      }
    };
  }, [audio, info.title, info.artist, info.ready]);
}
