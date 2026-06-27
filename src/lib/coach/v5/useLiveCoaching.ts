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
// After a cue is delivered, suppress AUTO cues for this long so the coach
// doesn't talk over the agent (§3.3). On-demand ("coach me") bypasses it.
const CUE_COOLDOWN_MS = 25_000;

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
  // F2: the recorded call audio, available after Stop, to feed the S1a
  // upload→diarize→label→review pipeline so a live session leaves a
  // persisted, reviewable record (§1.1). In-person only — the mic holds
  // both voices in a room; online video, it's agent-only.
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueInFlightRef = useRef(false);
  const modeRef = useRef<CueMode>("suggestion");
  const lastCueAtRef = useRef(0); // F4 cooldown (ms epoch); 0 = never

  // Speak a cue privately to the agent (reuses Jeff's flash TTS).
  const speakCue = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/care/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] cue TTS request failed", res.status);
        return;
      }
      // Play through the AudioContext (already unlocked by the Start click,
      // a user gesture) rather than a fresh new Audio() — browser autoplay
      // policy blocks programmatic Audio.play() that isn't tied to a
      // gesture, which is the most likely cause of "no cue audio"
      // (2026-06-27 diagnosis). Reuses the same ctx as mic capture.
      const ctx = ctxRef.current;
      if (!ctx) {
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] no AudioContext to play the cue");
        return;
      }
      if (ctx.state === "suspended") await ctx.resume();
      const arrayBuf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const node = ctx.createBufferSource();
      node.buffer = audioBuf;
      node.connect(ctx.destination);
      node.start();
    } catch (err) {
      // F3: never disrupt the call, but don't swallow silently.
      // eslint-disable-next-line no-console
      console.warn("[live-coaching] cue TTS failed", err);
    }
  }, []);

  // onDemand bypasses the F4 cooldown (the agent explicitly asked).
  const invokeCue = useCallback(
    async (onDemand = false) => {
      if (cueInFlightRef.current) return;
      const live = transcriptRef.current;
      if (live.length < 2) {
        // "Coach me now" shouldn't feel dead when there's nothing to read
        // yet (image 1: button did nothing).
        if (onDemand) {
          setCurrentCue("Still listening — say a bit more and I'll jump in.");
        }
        return;
      }
      if (
        !onDemand &&
        lastCueAtRef.current > 0 &&
        Date.now() - lastCueAtRef.current < CUE_COOLDOWN_MS
      ) {
        return; // within cooldown — don't auto-cue over a fresh cue
      }
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
        // Diagnosis: see whether the brain produced a cue or stayed silent.
        // eslint-disable-next-line no-console
        console.info("[live-coaching] cue result", {
          shouldCue: data?.cue?.shouldCue,
          hasText: Boolean(data?.cue?.cue),
        });
        if (data?.cue?.shouldCue && data.cue.cue) {
          lastCueAtRef.current = Date.now(); // start the cooldown
          setCurrentCue(data.cue.cue);
          void speakCue(data.cue.cue);
        }
      } catch (err) {
        // F3: never disrupt the call, but surface the cause.
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] cue request failed", err);
      } finally {
        cueInFlightRef.current = false;
      }
    },
    [sessionId, speakCue]
  );

  const requestCue = useCallback(() => {
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    void invokeCue(true); // on-demand bypasses the cooldown
  }, [invokeCue]);

  const stop = useCallback(() => {
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    // Stop the recorder FIRST (its onstop builds the blob) while the
    // stream is still live.
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* noop */
    }
    recorderRef.current = null;
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

      // F2: record the call audio in parallel for the post-call
      // transcript/review (S1a pipeline). Best-effort — a recorder
      // failure must never block live coaching.
      try {
        chunksRef.current = [];
        setRecordingBlob(null);
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          if (chunksRef.current.length > 0) {
            setRecordingBlob(
              new Blob(chunksRef.current, {
                type: chunksRef.current[0]?.type || "audio/webm",
              })
            );
          }
        };
        rec.start();
        recorderRef.current = rec;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] recorder unavailable", err);
      }

      // 2. Single-use token (server-minted; key never reaches the browser).
      const tokRes = await fetch("/api/coach/sales-session/realtime-token", {
        method: "POST",
      });
      if (!tokRes.ok) {
        const b = (await tokRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? "Couldn't get a realtime token.");
      }
      const { token } = await tokRes.json();

      // 3. AudioContext FIRST — prefer 16kHz so the PCM we send matches
      //    Scribe's default audio_format. We pass the real rate to the
      //    socket regardless.
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: 16000 });
      } catch {
        ctx = new AudioContext();
      }
      ctxRef.current = ctx;
      // Resume on the Start gesture so it can also play cue audio later
      // without hitting autoplay restrictions.
      if (ctx.state === "suspended") await ctx.resume();
      const sr = Math.round(ctx.sampleRate);

      // 4. WebSocket to Scribe v2 Realtime.
      //    commit_strategy=vad is REQUIRED: the default is "manual", which
      //    emits NOTHING unless the client sends commit:true — the cause of
      //    "socket open, audio sent, transcript empty" (2026-06-27 fix via
      //    the realtime AsyncAPI docs). audio_format matches our PCM rate.
      const ws = new WebSocket(
        `${REALTIME_WS}?token=${encodeURIComponent(token)}` +
          `&model_id=scribe_v2_realtime&commit_strategy=vad&audio_format=pcm_${sr}`
      );
      wsRef.current = ws;

      // 5. Audio graph. ScriptProcessorNode is deprecated but works;
      //    AudioWorklet is the eventual upgrade.
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      source.connect(proc);
      proc.connect(ctx.destination);

      let sentChunks = 0;
      proc.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        try {
          ws.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: floatTo16BitPCMBase64(input),
              sample_rate: sr,
            })
          );
          sentChunks += 1;
          if (sentChunks === 1 || sentChunks % 100 === 0) {
            // eslint-disable-next-line no-console
            console.info(
              `[live-coaching] sent ${sentChunks} audio chunks @ ${Math.round(ctx.sampleRate)}Hz`
            );
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[live-coaching] audio send failed", err);
        }
      };

      ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.info("[live-coaching] ws OPEN");
        setStatus("live");
      };
      ws.onerror = (ev) => {
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] ws ERROR", ev);
        setError("Realtime connection error.");
        setStatus("error");
      };
      ws.onclose = (ev) => {
        // eslint-disable-next-line no-console
        console.warn(
          `[live-coaching] ws CLOSE code=${ev.code} reason=${ev.reason || "(none)"}`
        );
        if (status === "live") setStatus("idle");
      };
      ws.onmessage = (ev) => {
        let msg: { message_type?: string; text?: string };
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch (err) {
          // F3: a malformed frame is skipped, but named — not silent.
          // eslint-disable-next-line no-console
          console.warn("[live-coaching] unparseable ws message", err);
          return;
        }
        // Diagnosis: log everything that ISN'T a routine partial, so
        // errors / session_started / unexpected types are visible.
        if (msg.message_type !== "partial_transcript") {
          // eslint-disable-next-line no-console
          console.info(
            "[live-coaching] ws msg:",
            msg.message_type ?? "(no type)",
            typeof ev.data === "string" ? ev.data.slice(0, 250) : ""
          );
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

  const clearRecording = useCallback(() => setRecordingBlob(null), []);

  return {
    recordingBlob,
    clearRecording,
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
