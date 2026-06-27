"use client";

import { useCallback, useRef, useState } from "react";
import type { CueMode } from "@/lib/data/salesCoach";

/**
 * useLiveCoaching — Live Sales Coach S1b (the realtime loop).
 *
 * mic → Scribe v2 Realtime websocket (browser-direct, single-use token)
 * → rolling transcript → cue brain (on committed-transcript pauses +
 * on-demand) → flash TTS to the agent's earpiece.
 *
 * The live transcript is CUE FUEL only — held in the browser, NOT
 * persisted. Persisting it alongside S1a's post-call diarized transcript
 * would duplicate the conversation in the append-only table and corrupt
 * the review (§3.1). Only the cues are recorded (via /cue → appendCue).
 *
 * Protocol verified against ElevenLabs docs (2026-06-27): wss
 * /v1/speech-to-text/realtime?token=…, send {message_type:
 * "input_audio_chunk", audio_base_64, sample_rate, commit}, receive
 * partial_transcript / committed_transcript {.text}.
 *
 * UNTESTED end-to-end — needs a real key + a real call. Built to the
 * verified protocol; latency / websocket / audio / playback are yours to
 * confirm on hardware.
 */

export type LiveStatus = "idle" | "connecting" | "live" | "error";

const REALTIME_WS = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
// Debounce auto-cue after a committed transcript so we cue at natural
// beats, not on every tiny commit (founder: "on pauses").
const AUTO_CUE_DEBOUNCE_MS = 4000;

function floatTo16BitPCMBase64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function useLiveCoaching(sessionId: string) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [currentCue, setCurrentCue] = useState<string | null>(null);
  const [mode, setMode] = useState<CueMode>("suggestion");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueInFlightRef = useRef(false);
  const modeRef = useRef<CueMode>("suggestion");

  // Speak a cue privately to the agent (reuses Jeff's flash TTS).
  const speakCue = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/care/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // Plays to the agent's local output (earpiece) — NOT into the call
      // mic stream, so the customer never hears it.
      void audio.play().catch(() => {});
      audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      /* TTS failure must never disrupt the call */
    }
  }, []);

  const invokeCue = useCallback(async () => {
    if (cueInFlightRef.current) return;
    const live = transcriptRef.current;
    if (live.length < 2) return; // not enough to read the situation
    cueInFlightRef.current = true;
    try {
      const res = await fetch(`/api/coach/sales-session/${sessionId}/cue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeRef.current,
          // Undifferentiated live transcript (no realtime diarization);
          // the brain reads it as the conversation.
          liveTranscript: live.slice(-12).map((text) => ({
            speaker: "unknown" as const,
            text,
          })),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.cue?.shouldCue && data.cue.cue) {
        setCurrentCue(data.cue.cue);
        void speakCue(data.cue.cue);
      }
    } catch {
      /* a cue failure must never disrupt the call */
    } finally {
      cueInFlightRef.current = false;
    }
  }, [sessionId, speakCue]);

  const requestCue = useCallback(() => {
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    void invokeCue();
  }, [invokeCue]);

  const stop = useCallback(() => {
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    try {
      procRef.current?.disconnect();
    } catch {
      /* noop */
    }
    procRef.current = null;
    try {
      void ctxRef.current?.close();
    } catch {
      /* noop */
    }
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      wsRef.current?.close();
    } catch {
      /* noop */
    }
    wsRef.current = null;
    setStatus("idle");
    setPartial("");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setTranscript([]);
    transcriptRef.current = [];
    try {
      // 1. Mic.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Single-use token (server-minted; key never reaches the browser).
      const tokRes = await fetch("/api/coach/sales-session/realtime-token", {
        method: "POST",
      });
      if (!tokRes.ok) {
        const b = (await tokRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? "Couldn't get a realtime token.");
      }
      const { token } = await tokRes.json();

      // 3. WebSocket to Scribe v2 Realtime.
      const ws = new WebSocket(
        `${REALTIME_WS}?token=${encodeURIComponent(token)}&model_id=scribe_v2_realtime`
      );
      wsRef.current = ws;

      // 4. Audio graph: capture PCM at the context's native rate (Scribe
      //    accepts 48kHz, so no resampling). ScriptProcessorNode is
      //    deprecated but works; AudioWorklet is the eventual upgrade.
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      source.connect(proc);
      proc.connect(ctx.destination);

      proc.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: floatTo16BitPCMBase64(input),
            sample_rate: Math.round(ctx.sampleRate),
          })
        );
      };

      ws.onopen = () => setStatus("live");
      ws.onerror = () => {
        setError("Realtime connection error.");
        setStatus("error");
      };
      ws.onclose = () => {
        if (status === "live") setStatus("idle");
      };
      ws.onmessage = (ev) => {
        let msg: { message_type?: string; text?: string };
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        if (msg.message_type === "partial_transcript") {
          setPartial(msg.text ?? "");
        } else if (
          msg.message_type === "committed_transcript" ||
          msg.message_type === "committed_transcript_with_timestamps"
        ) {
          const text = (msg.text ?? "").trim();
          setPartial("");
          if (!text) return;
          transcriptRef.current = [...transcriptRef.current, text];
          setTranscript(transcriptRef.current);
          // Auto-cue on the pause (debounced) — the brain decides whether
          // to actually speak.
          if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
          cueTimerRef.current = setTimeout(() => void invokeCue(), AUTO_CUE_DEBOUNCE_MS);
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      stop();
    }
  }, [invokeCue, status, stop]);

  const updateMode = useCallback((m: CueMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  return {
    status,
    transcript,
    partial,
    currentCue,
    mode,
    setMode: updateMode,
    error,
    start,
    stop,
    requestCue,
  };
}
