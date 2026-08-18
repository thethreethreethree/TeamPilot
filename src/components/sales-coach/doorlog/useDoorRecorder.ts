"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Door Log recorder hook (Macro Mode — RECORDING state). MediaRecorder for capture + an AnalyserNode
 * live input level for the "sound bar" (build-spec 2.1 — so the rep can confirm at a glance that audio is
 * being captured). Mic permission is requested ONCE on tab entry (arm()), not on the Record tap, so
 * capture starts within ~200ms of the tap.
 *
 * Field-safe: every browser API that can throw (getUserMedia, AudioContext) is guarded; a failure degrades
 * to "no recorder" rather than crashing the rep out of the flow.
 */
export function useDoorRecorder() {
  const [armed, setArmed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0); // 0..1 live input level for the sound bar
  const [elapsedMs, setElapsedMs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  /** Request the mic once (on tab entry) + build the analyser. Safe to call repeatedly. */
  const arm = useCallback(async () => {
    if (streamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      streamRef.current = stream;
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        /* no analyser → sound bar stays flat, recording still works */
      }
      setArmed(true);
      return true;
    } catch {
      return false; // mic denied / unavailable — the caller shows the honest "can't record" state
    }
  }, []);

  const tickLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (const v of buf) sum += v;
    setLevel(Math.min(1, sum / buf.length / 128));
    rafRef.current = requestAnimationFrame(tickLevel);
  }, []);

  const start = useCallback(async () => {
    const ok = await arm();
    if (!ok || !streamRef.current) return false;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
      rafRef.current = requestAnimationFrame(tickLevel);
      return true;
    } catch {
      return false;
    }
  }, [arm, tickLevel]);

  /** Stop capture and resolve the recorded audio blob (null if nothing captured). */
  const stop = useCallback((): Promise<{ blob: Blob | null; durationMs: number }> => {
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRecording(false);
    setLevel(0);
    const rec = recorderRef.current;
    return new Promise((resolve) => {
      if (!rec || rec.state === "inactive") {
        resolve({ blob: null, durationMs });
        return;
      }
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" })
          : null;
        resolve({ blob, durationMs });
      };
      try {
        rec.stop();
      } catch {
        resolve({ blob: null, durationMs });
      }
    });
  }, []);

  // Teardown on unmount — free the mic + audio graph (never leak the mic between doors).
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {
        /* noop */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void audioCtxRef.current?.close();
    };
  }, []);

  return { armed, recording, level, elapsedMs, arm, start, stop };
}
