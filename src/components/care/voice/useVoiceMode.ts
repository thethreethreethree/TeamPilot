"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoicePhase } from "./VoiceSurface";

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
const VAD_POLL_MS = 100;
const VAD_ENERGY_THRESHOLD = 18; // average byte frequency
const VAD_SILENCE_AFTER_SPEECH_MS = 1500;
const VAD_MIN_SPEECH_MS = 400; // ignore tiny clicks/breaths

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
        const audio = new Audio(audioUrl);
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
          void audio.play().catch(() => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          });
        });
        currentAudioRef.current = null;
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
   * after Jeff's TTS finishes.
   */
  const armRecorder = useCallback(() => {
    if (!callActiveRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;

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
   * Start the call. Requests mic permission, sets up
   * AudioContext + analyser for VAD, arms the recorder, starts
   * the polling loop.
   */
  const startCall = useCallback(async () => {
    if (callActiveRef.current) return;
    setVoiceMode(true);
    setVoicePhase("connecting");
    setVoiceTranscript(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      args.onError(
        "Couldn't access your microphone. Check your browser permissions and try again."
      );
      setVoicePhase("error");
      setVoiceMode(false);
      return;
    }
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
  }, [teardown]);

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
    // Back-compat aliases for consumers still on the old shape
    // (will be removed after both widgets are updated).
    startRecording: startCall,
    stopRecording: () => {
      // No-op in continuous mode — VAD handles turn ends.
      // Kept as a stub so existing consumers don't break.
    },
    exitVoiceMode: endCall,
  };
}
