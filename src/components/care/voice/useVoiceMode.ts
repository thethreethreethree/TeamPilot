"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoicePhase } from "./VoiceSurface";
import {
  checkMicPermission,
  detectBrowser,
  getRecoverySteps,
} from "./micPermission";

/**
 * Voice call hook — Phase 9, rewritten to "phone call" shape
 * per user feedback. Previous implementation was push-to-talk
 * (hold button to speak). User correctly noted that's a
 * walkie-talkie, not a phone call. New implementation:
 *
 *   1. Customer clicks Phone icon → startCall()
 *   2. Browser requests mic permission once (one-shot prompt)
 *   3. AudioContext + AnalyserNode poll the mic energy at 10Hz
 *   4. When energy goes above threshold → "customer speaking"
 *   5. When energy stays below threshold for N ms after speech
 *      → silence detected → send the audio chunk through STT
 *      → /messages → TTS → playback
 *   6. While Jeff speaks, mic is muted (otherwise we capture
 *      Jeff's voice and feedback-loop it through STT)
 *   7. When Jeff finishes, mic re-opens automatically — loop
 *      continues until customer clicks hang-up (endCall)
 *
 * Per §A14 the six phases are explicit:
 *   idle         — pre-call, "Call Jeff" button is showing
 *   connecting   — mic permission in flight
 *   listening    — actively capturing customer audio, VAD running
 *   processing   — silence detected, STT + LLM in flight
 *   speaking     — Jeff's TTS audio playing (mic muted)
 *   error        — surfaced via onError callback
 *
 * Per §A16 — the loop routes the transcript through the
 * existing /messages endpoint so Jeff's brain (Coach + Co-Pilot
 * + per-tenant product context) runs unchanged. Voice is at
 * the edges; the brain stays composable.
 */

export type StoredSession = {
  conversationId: string;
  sessionToken: string;
};

export type ReturnedMessage = {
  authorType: "customer" | "ai" | "agent" | "system";
  body: string;
  id?: string;
  createdAt?: string;
};

// VAD tuning constants — §A4 uncertainty. These are reasonable
// defaults; the §4 readout on voice will tell us whether they
// produce premature cutoffs or held-too-long lag. Adjust based
// on observed customer behavior.
//
// 2026-06-17 — tightened from 1500/400 to 700/250 after user
// reported "a lot of pause" between turns. The 1500ms silence
// threshold was the single biggest source of dead air after the
// customer stopped talking: pure wait before STT even started.
// 700ms is still long enough to ride past mid-sentence breaths
// for most speakers; if we see premature cutoffs in the wild we
// can nudge back up. MIN_SPEECH 250ms lets short replies ("yes",
// "ok") register faster without admitting clicks/breath puffs.
const VAD_POLL_MS = 100;
const VAD_ENERGY_THRESHOLD = 18; // average byte frequency
const VAD_SILENCE_AFTER_SPEECH_MS = 700;
const VAD_MIN_SPEECH_MS = 250; // ignore tiny clicks/breaths

// 44-byte silent WAV (44.1kHz, 16-bit mono, 0 samples). Used to
// prime <audio> for iOS Safari's autoplay policy — playing this
// during the user-gesture from the initial "Call Jeff" tap
// "unlocks" the element so subsequent .play() calls after async
// awaits (STT/LLM/TTS) are allowed.
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function useVoiceMode(args: {
  ensureSession: () => Promise<StoredSession | null>;
  onCustomerMessageOptimistic: (args: {
    tempId: string;
    body: string;
  }) => void;
  onMessagesReturned: (messages: ReturnedMessage[]) => void;
  onRemoveOptimistic: (tempId: string) => void;
  onError: (msg: string) => void;
}) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [permissionDeniedSteps, setPermissionDeniedSteps] = useState<
    string[] | null
  >(null);

  // Refs hold the live media + audio analysis objects. They
  // need to be refs (not state) because the VAD polling loop
  // reads them on every tick and we don't want re-renders.
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const vadIntervalRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const callActiveRef = useRef(false); // tracks "are we in a call" without going through render
  const speechStartedAtRef = useRef<number | null>(null);
  const lastEnergyAboveAtRef = useRef<number | null>(null);

  /**
   * Tear down everything — mic, audio context, polling interval,
   * any playing audio. Idempotent: safe to call multiple times.
   */
  const teardown = useCallback(() => {
    callActiveRef.current = false;
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    audioChunksRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    speechStartedAtRef.current = null;
    lastEnergyAboveAtRef.current = null;
  }, []);

  /**
   * Play Jeff's reply, with the mic muted while audio plays so
   * we don't feedback-loop. Returns when audio finishes.
   */
  const speakReply = useCallback(
    async (text: string, sessionToken: string) => {
      try {
        setVoicePhase("speaking");
        // Mute the mic recorder while Jeff speaks.
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "recording") {
          recorder.pause();
        }

        const res = await fetch(`/api/care/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-care-session": sessionToken,
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          args.onError(
            "Couldn't play Jeff's reply. You can still read it above."
          );
          return;
        }
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Reuse the gesture-unlocked element from startCall so iOS
        // Safari allows playback. Fall back to a fresh element if
        // somehow the ref was cleared (defensive — shouldn't
        // happen mid-call).
        const audio = currentAudioRef.current ?? new Audio();
        audio.src = audioUrl;
        audio.load();
        currentAudioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          void audio.play().catch((err) => {
            // Log so we can see autoplay rejections in production
            // devtools. Without this we lose the diagnostic trail
            // for "the call connected but I heard nothing" reports.
            if (typeof console !== "undefined") {
              const name = err instanceof Error ? err.name : "unknown";
              const message = err instanceof Error ? err.message : "";
              console.error(
                `[care/voice] audio.play() rejected: name=${name} message="${message}"`
              );
            }
            URL.revokeObjectURL(audioUrl);
            resolve();
          });
        });
      } catch {
        args.onError("Audio playback failed. You can still read above.");
      }
    },
    [args]
  );

  /**
   * End-of-turn handler. Pulled out of the VAD loop so it
   * can be called from the polling tick when silence is
   * detected.
   */
  const handleEndOfTurn = useCallback(async () => {
    if (!callActiveRef.current) return;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    // Stop the current recording chunk. onstop will fire.
    recorder.stop();
  }, []);

  /**
   * Re-arm the recorder for the next customer turn. Called
   * after Jeff's TTS finishes OR after any failure in the
   * STT/messages/TTS chain — the call stays alive, we just
   * keep listening.
   *
   * Always sets phase back to "listening" so the UI doesn't
   * stay stuck on "processing" or "speaking" after a failure
   * (user-reported bug 2026-06-17).
   */
  const armRecorder = useCallback(() => {
    if (!callActiveRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;
    setVoicePhase("listening");

    audioChunksRef.current = [];
    speechStartedAtRef.current = null;
    lastEnergyAboveAtRef.current = null;

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      if (!callActiveRef.current) return;

      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      if (audioBlob.size === 0) {
        // Empty chunk — rearm and keep listening.
        armRecorder();
        return;
      }

      setVoicePhase("processing");

      const active = await args.ensureSession();
      if (!active) {
        if (callActiveRef.current) armRecorder();
        return;
      }

      // 1. Transcribe.
      let transcript: string;
      try {
        const sttRes = await fetch(`/api/care/stt`, {
          method: "POST",
          headers: {
            "Content-Type": audioBlob.type,
            "x-care-session": active.sessionToken,
          },
          body: audioBlob,
        });
        if (!sttRes.ok) {
          const data = await sttRes.json().catch(() => ({}));
          args.onError(data.error || "Couldn't transcribe. Try again.");
          if (callActiveRef.current) armRecorder();
          return;
        }
        const data = await sttRes.json();
        transcript = (data.transcript as string) ?? "";
      } catch {
        args.onError("Couldn't reach the server.");
        if (callActiveRef.current) armRecorder();
        return;
      }

      if (!transcript.trim()) {
        // STT returned empty — likely just noise. Skip the
        // /messages call and re-arm.
        if (callActiveRef.current) armRecorder();
        return;
      }

      setVoiceTranscript(transcript);
      const tempId = `temp-voice-${Date.now()}`;
      args.onCustomerMessageOptimistic({ tempId, body: transcript });

      // 2. Send to /messages — Jeff's brain runs unchanged.
      let aiReplyText = "";
      try {
        const msgRes = await fetch(
          `/api/care/conversations/${active.conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-care-session": active.sessionToken,
            },
            body: JSON.stringify({ body: transcript, medium: "voice" }),
          }
        );
        if (!msgRes.ok) {
          args.onError("Couldn't send to Jeff. Try again.");
          args.onRemoveOptimistic(tempId);
          if (callActiveRef.current) armRecorder();
          return;
        }
        const data = await msgRes.json();
        const updated = (data.messages ?? []) as ReturnedMessage[];
        args.onMessagesReturned(updated);
        const lastAi = [...updated]
          .reverse()
          .find((m) => m.authorType === "ai");
        aiReplyText = lastAi?.body ?? "";
      } catch {
        args.onError("Couldn't reach the server.");
        args.onRemoveOptimistic(tempId);
        if (callActiveRef.current) armRecorder();
        return;
      }

      // 3. Play Jeff's reply.
      if (aiReplyText) {
        await speakReply(aiReplyText, active.sessionToken);
      }

      // 4. Re-arm if call is still active.
      if (callActiveRef.current) {
        setVoicePhase("listening");
        armRecorder();
      }
    };

    recorder.start();
  }, [args, speakReply]);

  /**
   * Start the call. Requests mic permission FIRST (before any
   * React state updates) so the user-gesture context is preserved
   * on iOS Safari — re-renders between the click and the
   * getUserMedia call cause some browsers to suppress the
   * permission prompt entirely.
   *
   * Cross-platform notes:
   *   - HTTPS required everywhere except localhost. On HTTP
   *     production URLs, navigator.mediaDevices is undefined.
   *   - iOS Safari: must be called inside the synchronous tail
   *     of the click handler. Async-then-await pattern is fine
   *     as long as nothing re-renders between click and await.
   *   - Android Chrome: same as iOS Safari.
   *   - Iframes: the iframe element on the host page needs
   *     allow="microphone" (handled in public/care-widget.js).
   */
  const startCall = useCallback(async () => {
    if (callActiveRef.current) return;

    // ─── iOS Safari audio unlock (gesture-context required) ───
    // 2026-06-17 — user reported no audio on iPhone after a call
    // connected on desktop fine. Cause: by the time speakReply()
    // calls audio.play(), the user-gesture from the original
    // "Call Jeff" tap is long gone (we've awaited STT + LLM + TTS,
    // ~3-5 seconds each). iOS Safari treats post-await .play() as
    // an autoplay attempt and silently rejects it — no error
    // panel, just dead air.
    //
    // Fix: create the Audio element and call .play() on a silent
    // buffer NOW while the gesture is hot. iOS marks this specific
    // element as "user-allowed-to-play"; it stays unlocked for the
    // page lifetime. Every subsequent speakReply reuses this same
    // element by swapping .src, so iOS plays without complaint.
    //
    // No await before .play() — the gesture context dies at the
    // first await, so this must be the first thing we do.
    const primedAudio = new Audio();
    primedAudio.preload = "auto";
    primedAudio.src = SILENT_WAV_DATA_URI;
    // Fire-and-forget. Some browsers reject; that's fine, we tried.
    void primedAudio.play().catch(() => {
      /* iOS may still reject in edge cases (e.g., insecure
         context). The .play() invocation itself is what registers
         the gesture intent on supported devices. */
    });
    currentAudioRef.current = primedAudio;

    // ─── Capability detection — surface real errors ─────────
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      // Most common cause: not on HTTPS in production. The
      // mediaDevices API is gated to secure contexts.
      const insecure =
        typeof window !== "undefined" &&
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";
      args.onError(
        insecure
          ? "Voice calls require HTTPS. Reload the page on an https:// URL and try again."
          : "Your browser doesn't support voice calls. Try a recent version of Safari, Chrome, or Firefox."
      );
      return;
    }

    // ─── No Permissions API pre-check ──────────────────────
    // Earlier versions ran navigator.permissions.query for
    // microphone before getUserMedia to fast-path the "already
    // denied" case. That produced false positives: the cached
    // Permissions API state stays 'denied' for the lifetime of
    // a tab even after the user manually changes the permission
    // to 'allow' in chrome://settings. The user reported this
    // 2026-06-17 with a screenshot showing Microphone=Allow in
    // Chrome's site settings while our widget still said
    // "blocked."
    //
    // The honest source of truth is getUserMedia itself — it
    // respects the current permission state, not the cached one.
    // So: skip the pre-check. Call getUserMedia. Only on its
    // failure do we decide whether to show the denial panel.

    // ─── Request mic IMMEDIATELY (user-gesture context) ─────
    // No React state updates before this line. iOS Safari and
    // Android Chrome both lose the gesture context if there's
    // an intervening render.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof Error ? e.name : "unknown";
      const message = e instanceof Error ? e.message : "";
      // Always log the real error so we can diagnose production
      // issues from devtools. The user on 2026-06-17 reported
      // "Microphone is blocked" while chrome://settings clearly
      // showed Allow — without the actual error name we can't
      // tell whether the cause is iframe sandboxing, Permissions-
      // Policy, OS-level permission, or something else.
      if (typeof console !== "undefined") {
        console.error(
          `[care/voice] getUserMedia failed: name=${name} message="${message}"`
        );
      }
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        // Permission denied via the prompt OR by a Permissions-
        // Policy block. Either way, the customer needs to enable
        // it. Show the help panel inside the surface, not just
        // the thin error bar.
        const browser = detectBrowser();
        setPermissionDeniedSteps(getRecoverySteps(browser));
        setVoicePhase("error");
        setVoiceMode(true); // Open the surface so the help panel renders
        return;
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        args.onError(
          "No microphone detected. Make sure your device has a microphone enabled and try again."
        );
      } else if (
        name === "NotReadableError" ||
        name === "TrackStartError"
      ) {
        args.onError(
          "Your microphone is in use by another app. Close other apps using the mic and try again."
        );
      } else if (name === "OverconstrainedError") {
        args.onError(
          "Your microphone doesn't support the required audio format."
        );
      } else {
        args.onError(
          "Couldn't access your microphone. Check your browser permissions and try again."
        );
      }
      return;
    }

    // Now safe to update state — mic permission already resolved.
    setVoiceMode(true);
    setVoicePhase("connecting");
    setVoiceTranscript(null);
    streamRef.current = stream;

    // AudioContext for VAD energy polling.
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AC();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyserRef.current = analyser;

    callActiveRef.current = true;
    setVoicePhase("listening");
    armRecorder();

    // VAD polling loop. Runs every VAD_POLL_MS while the call
    // is active. Reads the analyser's frequency buffer, computes
    // average byte energy, applies hysteresis to detect end of
    // speech.
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!callActiveRef.current) return;
      if (voicePhase === "speaking" || voicePhase === "processing") return;
      analyser.getByteFrequencyData(buffer);
      let total = 0;
      for (let i = 0; i < buffer.length; i++) total += buffer[i]!;
      const energy = total / buffer.length;
      const now = Date.now();

      if (energy >= VAD_ENERGY_THRESHOLD) {
        lastEnergyAboveAtRef.current = now;
        if (speechStartedAtRef.current === null) {
          speechStartedAtRef.current = now;
        }
      } else if (
        speechStartedAtRef.current !== null &&
        lastEnergyAboveAtRef.current !== null
      ) {
        const speechDurationMs =
          lastEnergyAboveAtRef.current - speechStartedAtRef.current;
        const silenceDurationMs = now - lastEnergyAboveAtRef.current;
        if (
          speechDurationMs >= VAD_MIN_SPEECH_MS &&
          silenceDurationMs >= VAD_SILENCE_AFTER_SPEECH_MS
        ) {
          // End of turn detected. Reset trackers; the onstop
          // handler on the recorder will pick up and process.
          speechStartedAtRef.current = null;
          lastEnergyAboveAtRef.current = null;
          void handleEndOfTurn();
        }
      }
    };
    vadIntervalRef.current = window.setInterval(tick, VAD_POLL_MS);
  }, [args, armRecorder, handleEndOfTurn, voicePhase]);

  /**
   * Hang up. Tears down everything. The hook contract: after
   * endCall(), voiceMode goes false (consumer re-renders text
   * composer) and all media resources are released.
   */
  const endCall = useCallback(() => {
    teardown();
    setVoiceMode(false);
    setVoicePhase("idle");
    setVoiceTranscript(null);
    setPermissionDeniedSteps(null);
  }, [teardown]);

  /**
   * Used by the help panel's "Try again" affordance after the
   * customer has (presumably) re-enabled mic permission in the
   * browser. Clears the denial state and re-attempts startCall.
   */
  const retryCall = useCallback(async () => {
    setPermissionDeniedSteps(null);
    setVoicePhase("idle");
    setVoiceMode(false);
    // Defer to the next tick so the surface unmounts/remounts
    // cleanly before we try again — some browsers won't show a
    // fresh prompt if we call getUserMedia immediately after a
    // denial.
    await new Promise((r) => setTimeout(r, 50));
    await startCall();
  }, [startCall]);

  // Cleanup on unmount — make sure we don't leak the mic.
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return {
    voiceMode,
    setVoiceMode,
    voicePhase,
    voiceTranscript,
    /** Start the call. Replaces the old startRecording. */
    startCall,
    /** Hang up. Replaces the old exitVoiceMode + stopRecording. */
    endCall,
    /** Re-attempt after the customer manually re-enabled mic. */
    retryCall,
    /** Browser-specific recovery steps when permission is
     *  denied. Null when permission hasn't been denied or
     *  hasn't been checked yet. */
    permissionDeniedSteps,
  };
}
