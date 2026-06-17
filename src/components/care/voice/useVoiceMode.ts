"use client";

import { useCallback, useRef, useState } from "react";
import type { VoicePhase } from "./VoiceSurface";

/**
 * Voice mode hook — Phase 9. Encapsulates the recording / STT /
 * messaging / TTS loop so both customer widgets (CareEmbeddedWidget
 * and CareChatWidget) consume the same logic. Per §A13 the
 * vocabulary lives in one place; per §A16 the loop preserves
 * composition by routing the transcript through the existing
 * /messages endpoint (Coach grades the same way, Co-Pilot runs
 * the same way).
 *
 * The hook is intentionally agnostic about the widget's message
 * type — it calls back into the consumer's state management
 * rather than imposing a shape. The consumer:
 *   - Provides ensureSession() — the same one their text composer
 *     uses
 *   - Receives onCustomerMessageOptimistic when STT returns
 *     (so the consumer can add an optimistic bubble to its stream)
 *   - Receives onMessagesReturned with the fresh messages from
 *     /messages (so the consumer can replace its state)
 *   - Receives onError when anything in the loop fails
 *
 * The hook owns:
 *   - The MediaRecorder lifecycle (mic permission, recording,
 *     audio chunks)
 *   - The STT request
 *   - The /messages POST
 *   - The TTS request + Audio playback
 *   - The voicePhase state machine
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

export function useVoiceMode(args: {
  ensureSession: () => Promise<StoredSession | null>;
  onCustomerMessageOptimistic: (args: {
    tempId: string;
    body: string;
  }) => void;
  /** Called when /messages returns. Pass through to setMessages. */
  onMessagesReturned: (messages: ReturnedMessage[]) => void;
  /** Called when the optimistic temp message needs to be removed
   *  (e.g., /messages failed). */
  onRemoveOptimistic: (tempId: string) => void;
  onError: (msg: string) => void;
}) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakReply = useCallback(
    async (text: string, sessionToken: string) => {
      try {
        setVoicePhase("speaking");
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
          setVoicePhase("idle");
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
        setVoicePhase("idle");
      } catch {
        args.onError("Audio playback failed. You can still read above.");
        setVoicePhase("idle");
      }
    },
    [args]
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (voicePhase !== "idle") return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      args.onError(
        "Couldn't access your microphone. Check your browser permissions and try again."
      );
      setVoicePhase("error");
      return;
    }

    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const active = await args.ensureSession();
      if (!active) {
        setVoicePhase("idle");
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      if (audioBlob.size === 0) {
        setVoicePhase("idle");
        return;
      }

      setVoicePhase("transcribing");

      // 1. Transcribe via STT.
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
          setVoicePhase("idle");
          return;
        }
        const data = await sttRes.json();
        transcript = (data.transcript as string) ?? "";
      } catch {
        args.onError("Couldn't reach the server.");
        setVoicePhase("idle");
        return;
      }

      if (!transcript.trim()) {
        args.onError("Didn't catch that. Try again.");
        setVoicePhase("idle");
        return;
      }

      setVoiceTranscript(transcript);
      const tempId = `temp-voice-${Date.now()}`;
      args.onCustomerMessageOptimistic({ tempId, body: transcript });

      // 2. Send transcript through the existing /messages endpoint
      // so Jeff's brain runs unchanged per §A16. medium=voice for
      // the §4 readout.
      setVoicePhase("thinking");
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
          setVoicePhase("idle");
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
        setVoicePhase("idle");
        return;
      }

      if (!aiReplyText) {
        setVoicePhase("idle");
        return;
      }
      await speakReply(aiReplyText, active.sessionToken);
    };

    recorder.start();
    setVoicePhase("recording");
  }, [args, speakReply, voicePhase]);

  const exitVoiceMode = useCallback(() => {
    stopRecording();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setVoiceMode(false);
    setVoicePhase("idle");
    setVoiceTranscript(null);
  }, [stopRecording]);

  return {
    voiceMode,
    setVoiceMode,
    voicePhase,
    voiceTranscript,
    startRecording,
    stopRecording,
    exitVoiceMode,
  };
}
