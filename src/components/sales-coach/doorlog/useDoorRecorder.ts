"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Door Log recorder hook (Macro Mode — RECORDING state). MediaRecorder for capture + an AnalyserNode
 * live input level for the "sound bar" (build-spec 2.1 — so the rep can confirm at a glance that audio is
 * being captured). Mic permission is requested ONCE on tab entry (arm()), not on the Record tap, so
 * capture starts within ~200ms of the tap.
 *
 * DURABILITY (founder 2026-08-22, two field reports — "the recording didn't save" on an 8-min call, and "it
 * was recording then it stopped"): the recorder now emits ~15s CHUNKS that upload to storage DURING recording
 * (mirrors the live-coaching path), so a long recording never rides on one large final upload and whatever was
 * captured before an early stop is already durable. A SCREEN WAKE LOCK is held while recording so the phone
 * doesn't dim/lock from inactivity and kill the mic track mid-conversation. Both are ADDITIVE: the clean-Stop
 * full blob still resolves from stop() as before (the fallback when chunking is unavailable), and every
 * throwing browser API is guarded — a failure degrades, never crashes the rep out of the flow.
 */

const DOOR_LOG_CHUNK_URL = "/api/coach/sales-session/door-log/audio-chunk";
// MediaRecorder timeslice → ondataavailable fires this often, each firing a ~150-300 KB webm chunk we upload.
const AUDIO_CHUNK_MS = 15_000;

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
  // Incremental-upload state (per recording).
  const recordingIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const uploadedRef = useRef(0); // count of chunks that reached storage (drives the chunked-vs-fallback save)
  // Screen wake lock — kept while recording so the phone doesn't lock/dim and end the mic track.
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  /** Upload one recording chunk, best-effort with ONE idempotent retry. seq 0 carries the webm header, so its
   *  loss makes the whole recording unstitchable — the retry matters most there. Counts successful uploads. */
  const uploadChunk = useCallback((recordingId: string, seq: number, blob: Blob) => {
    const attempt = () =>
      fetch(`${DOOR_LOG_CHUNK_URL}?rid=${recordingId}&seq=${seq}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      }).then((r) => {
        if (!r.ok) throw new Error(`chunk ${seq} HTTP ${r.status}`);
      });
    const ok = () => {
      uploadedRef.current += 1;
    };
    void attempt()
      .then(ok)
      .catch(() => {
        setTimeout(() => {
          void attempt().then(ok).catch(() => {
            /* best-effort — the clean-Stop full blob is the fallback, and the stitch keeps whatever landed */
          });
        }, 1500);
      });
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (!nav.wakeLock) return;
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      /* wake lock unsupported / denied → recording still works; screen may lock (chunks already protect the audio) */
    }
  }, []);
  const releaseWakeLock = useCallback(() => {
    const wl = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wl) void wl.release().catch(() => {});
  }, []);

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

  /**
   * Start capture. `recordingId` keys the incremental chunk uploads (a uuid minted by the caller at Record-tap);
   * when omitted, capture still works but no chunks upload (the clean-Stop blob is then the only audio).
   */
  const start = useCallback(
    async (recordingId?: string) => {
      const ok = await arm();
      if (!ok || !streamRef.current) return false;
      try {
        chunksRef.current = [];
        seqRef.current = 0;
        uploadedRef.current = 0;
        recordingIdRef.current = recordingId ?? null;
        const rec = new MediaRecorder(streamRef.current);
        rec.ondataavailable = (e) => {
          if (e.data.size === 0) return;
          chunksRef.current.push(e.data);
          // Upload this chunk during recording (durability). seq is assigned in emission order.
          const rid = recordingIdRef.current;
          if (rid) uploadChunk(rid, seqRef.current++, e.data);
        };
        // Timeslice → ondataavailable fires every AUDIO_CHUNK_MS (not just once on stop), so chunks upload as we
        // go instead of one large blob at the end (the long-recording upload failure this fix exists to kill).
        rec.start(AUDIO_CHUNK_MS);
        recorderRef.current = rec;
        startedAtRef.current = Date.now();
        setElapsedMs(0);
        setRecording(true);
        // Mark a recording in progress so VersionWatcher never auto-reloads mid-pitch (it guards on this exact
        // flag — the same protection the live-coaching recorder gets). Cleared on stop/teardown.
        if (typeof document !== "undefined") document.body.dataset.recording = "1";
        void requestWakeLock();
        timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
        rafRef.current = requestAnimationFrame(tickLevel);
        return true;
      } catch {
        return false;
      }
    },
    [arm, tickLevel, uploadChunk, requestWakeLock],
  );

  /**
   * Stop capture and resolve the recorded audio. `blob` is the full clean-Stop recording (null if nothing
   * captured); `chunksUploaded` is how many ~15s chunks reached storage during recording (the caller saves via
   * the stitched recordingId when >0, and falls back to uploading `blob` when 0).
   */
  const stop = useCallback((): Promise<{ blob: Blob | null; durationMs: number; chunksUploaded: number }> => {
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRecording(false);
    setLevel(0);
    releaseWakeLock();
    if (typeof document !== "undefined") delete document.body.dataset.recording;
    const rec = recorderRef.current;
    return new Promise((resolve) => {
      const chunksUploaded = uploadedRef.current;
      if (!rec || rec.state === "inactive") {
        resolve({ blob: null, durationMs, chunksUploaded });
        return;
      }
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" })
          : null;
        resolve({ blob, durationMs, chunksUploaded: uploadedRef.current });
      };
      try {
        rec.stop();
      } catch {
        resolve({ blob: null, durationMs, chunksUploaded });
      }
    });
  }, [releaseWakeLock]);

  // Re-acquire the wake lock when the tab becomes visible again while still recording (mobile releases it on hide).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && recorderRef.current && recorderRef.current.state === "recording") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  // Teardown on unmount — free the mic + audio graph + wake lock (never leak between doors).
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      releaseWakeLock();
      if (typeof document !== "undefined") delete document.body.dataset.recording;
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
  }, [releaseWakeLock]);

  return { armed, recording, level, elapsedMs, arm, start, stop };
}
