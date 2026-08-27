"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildCaptureDiag, type CaptureDiag } from "@/lib/coach/captureDiag";

// Re-exported so existing consumers (DoorLog) keep importing CaptureDiag from here; the canonical definition +
// builder live in @/lib/coach/captureDiag (shared with the live/meeting/C.A.R.E recorders — one source, no drift).
export type { CaptureDiag };

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
// MediaRecorder timeslice → ondataavailable fires this often, each firing a ~150-300 KB chunk we upload.
const AUDIO_CHUNK_MS = 15_000;

/** iPhone/iPod/iPad, plus iPadOS 13+ which masquerades as desktop Safari (Macintosh UA + a touch surface). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

/**
 * Pick a mimeType the browser can ACTUALLY encode. Passing no type lets the browser choose; being explicit avoids a
 * silent no-data start on a browser whose default it can't encode.
 *
 * iOS REGRESSION FIX (founder 2026-08-27, field telemetry): iOS Safari 18.x now FALSELY reports audio/webm as
 * supported (isTypeSupported → true), but MediaRecorder then produces a sub-1KB STUB with no audio — 100% of the empty
 * DoorLog captures were iOS recording as "audio/webm;codecs=opus" (sawData=true, tiny blob, chunksUploaded=0, no track
 * loss / no recorder error). The 2026-08-23 change preferred webm for EVERY browser, which is exactly what broke iOS.
 * iOS reliably encodes mp4/aac, so prefer those on iOS; keep webm-first elsewhere (the pipeline is webm-native and
 * Chrome/Android webm works). "" → let the browser default.
 */
export function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const order = isIOS()
    ? ["audio/mp4", "audio/aac", "audio/mpeg", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/mpeg"];
  for (const t of order) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* isTypeSupported can throw on some engines — treat as unsupported */
    }
  }
  return "";
}

export function useDoorRecorder() {
  const [armed, setArmed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0); // 0..1 live input level for the sound bar
  const [elapsedMs, setElapsedMs] = useState(0);
  // The mic stopped delivering audio mid-recording (track ended/muted). Surfaced LIVE so the rep can recover the
  // pitch in the moment (unlock the phone / bring the app forward) instead of discovering "no audio" afterward.
  const [captureInterrupted, setCaptureInterrupted] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // The analyser runs on a CLONED mic track (not the recording stream) — see arm(). Kept so teardown stops it.
  const analyserStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // iOS Safari IGNORES MediaRecorder.start(timeslice) — it never fires periodic ondataavailable, so no chunks upload
  // mid-recording (field data 2026-08-25: 12/12 empty captures were iOS, all chunksUploaded=0) and a long recording
  // that loses its mic track is TOTALLY lost. This interval FORCES a chunk via requestData() whenever the timeslice
  // hasn't delivered one — the documented iOS workaround. `lastDataAt` makes it adaptive: a no-op on browsers that DO
  // honor timeslice (Chrome/Android keep it fresh), essential on iOS (it stays stale → we force each interval).
  const chunkForceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDataAtRef = useRef(0);
  const unmountedRef = useRef(false);
  // Incremental-upload state (per recording).
  const recordingIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const uploadedRef = useRef(0); // count of chunks that reached storage (drives the chunked-vs-fallback save)
  // Did seq 0 (the container header) specifically reach storage? The server stitch needs a contiguous run FROM 0, so
  // if seq 0 is lost but later chunks upload, chunksUploaded>0 but the stitch is unbuildable — the caller must then
  // fall back to the clean-Stop blob (which DOES contain the header) instead of the doomed recordingId path.
  const seq0OkRef = useRef(false);
  // Screen wake lock — kept while recording so the phone doesn't lock/dim and end the mic track.
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const wakeLockGrantedRef = useRef(false);
  // Ground-truth capture observations (per recording) — feed CaptureDiag so a zero-audio outcome is explainable.
  const sawDataRef = useRef(false);
  const capturedBytesRef = useRef(0); // TOTAL bytes across all data events — sawData is true even for a 5-byte trailer
  //   (the iOS stub, 2026-08-25), so THIS is the real "was there audio" signal used to gate the save.
  const recorderErrorRef = useRef<string | null>(null);
  const trackEndedRef = useRef(false);
  const trackMutedRef = useRef(false);
  const hiddenDuringRef = useRef(0);
  const mimeTypeRef = useRef("");

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
      if (seq === 0) seq0OkRef.current = true; // the header landed → the stitch has a valid start
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
      wakeLockGrantedRef.current = true; // it actually took (often FALSE on iOS Safari / in-app browsers — a top cause)
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
        // iOS Safari (field data 2026-08-23): an AudioContext consuming the SAME MediaStream that MediaRecorder
        // records can leave the recorder with ZERO audio data (mic track alive, no recorder error — just silence).
        // Feed the sound-bar analyser a CLONED track so MediaRecorder gets the untouched recording stream. If clone
        // is unavailable, fall back to the original stream (a degraded meter beats losing the recording).
        let analyserSource: MediaStream = stream;
        try {
          const track = stream.getAudioTracks()[0];
          if (track && typeof track.clone === "function") {
            const cloned = new MediaStream([track.clone()]);
            analyserStreamRef.current = cloned;
            analyserSource = cloned;
          }
        } catch {
          /* clone unsupported → analyser reads the original stream (old behavior) */
        }
        const src = ctx.createMediaStreamSource(analyserSource);
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
        seq0OkRef.current = false;
        recordingIdRef.current = recordingId ?? null;
        // Reset per-recording diagnostics + the live interruption flag.
        sawDataRef.current = false;
        capturedBytesRef.current = 0;
        recorderErrorRef.current = null;
        trackEndedRef.current = false;
        trackMutedRef.current = false;
        hiddenDuringRef.current = 0;
        wakeLockGrantedRef.current = false;
        setCaptureInterrupted(false);
        // Record tap is a user gesture → resume the AudioContext so the sound-bar analyser actually runs on iOS
        // Safari (a fresh AudioContext starts SUSPENDED and gives a misleading flat bar otherwise — the rep can't
        // trust it as a "capture is working" signal). Best-effort; recording works regardless.
        if (audioCtxRef.current?.state === "suspended") void audioCtxRef.current.resume().catch(() => {});
        // Watch the actual MIC TRACK: if it ENDS or MUTES mid-pitch (screen-lock / DND / a phone call / another app
        // grabbing the mic — the top iOS "recorded nothing" cause), the recorder silently yields no data. Detect it
        // so we can (a) WARN the rep live to recover the pitch, and (b) report it as the ground-truth cause.
        const track = streamRef.current.getAudioTracks()[0];
        if (track) {
          track.onended = () => {
            trackEndedRef.current = true;
            if (!unmountedRef.current) setCaptureInterrupted(true);
          };
          track.onmute = () => {
            trackMutedRef.current = true;
            if (!unmountedRef.current) setCaptureInterrupted(true);
          };
          track.onunmute = () => {
            /* track resumed — keep the flag set; the rep was already warned and some audio was likely lost */
          };
        }
        // Explicit, verified mimeType (see pickSupportedMimeType) — avoids a silent no-data start on iOS Safari.
        const chosenMime = pickSupportedMimeType();
        const rec = chosenMime
          ? new MediaRecorder(streamRef.current, { mimeType: chosenMime })
          : new MediaRecorder(streamRef.current);
        // Capture the recorder's ACTUAL mimeType (post-construction) for the diagnostics.
        mimeTypeRef.current = rec.mimeType || chosenMime || "";
        rec.ondataavailable = (e) => {
          lastDataAtRef.current = Date.now(); // timeslice IS delivering → the force-interval below stays a no-op
          if (e.data.size === 0) return;
          sawDataRef.current = true;
          capturedBytesRef.current += e.data.size; // real audio volume — distinguishes a media capture from a bare trailer
          chunksRef.current.push(e.data);
          // Upload this chunk during recording (durability). seq is assigned in emission order.
          const rid = recordingIdRef.current;
          if (rid) uploadChunk(rid, seqRef.current++, e.data);
        };
        // A MediaRecorder 'error' (encoder failure, track loss) used to vanish silently — capture it as the cause.
        rec.onerror = (e: Event) => {
          const err = (e as unknown as { error?: { name?: string; message?: string } }).error;
          recorderErrorRef.current = err?.name || err?.message || "MediaRecorder error";
          if (!unmountedRef.current) setCaptureInterrupted(true);
        };
        // Timeslice → ondataavailable fires every AUDIO_CHUNK_MS (not just once on stop), so chunks upload as we
        // go instead of one large blob at the end (the long-recording upload failure this fix exists to kill).
        rec.start(AUDIO_CHUNK_MS);
        lastDataAtRef.current = Date.now();
        // Force a chunk when the timeslice hasn't delivered one (iOS Safari never does). requestData() triggers an
        // immediate ondataavailable WITHOUT stopping — its blob is a valid webm continuation chunk that byte-concats
        // like a timeslice chunk (the server stitch already handles this), so partial audio becomes durable even if
        // the mic track later ends mid-pitch (the track can die early even on a long pitch, so force from ~15s, not
        // 30s). Best-effort: requestData can throw if unsupported → the clean-Stop blob remains the fallback.
        // requestData() flushes only the DELTA since the last ondataavailable, so a chunk forced right after a
        // timeslice chunk on a browser that honors timeslice is near-empty — never a duplicate/overlap.
        if (chunkForceRef.current) clearInterval(chunkForceRef.current);
        chunkForceRef.current = setInterval(() => {
          const r = recorderRef.current;
          if (!r || r.state !== "recording") return;
          if (Date.now() - lastDataAtRef.current >= AUDIO_CHUNK_MS) {
            try { r.requestData(); } catch { /* unsupported → nothing to force; fallback blob still resolves on stop */ }
          }
        }, AUDIO_CHUNK_MS);
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
  const stop = useCallback((): Promise<{ blob: Blob | null; durationMs: number; chunksUploaded: number; seq0Uploaded: boolean; diag: CaptureDiag }> => {
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    if (timerRef.current) clearInterval(timerRef.current);
    if (chunkForceRef.current) clearInterval(chunkForceRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRecording(false);
    setLevel(0);
    releaseWakeLock();
    if (typeof document !== "undefined") delete document.body.dataset.recording;
    const rec = recorderRef.current;
    // Assemble the diagnostic via the SHARED builder (one source of the shape + defaults across all recorders).
    const buildDiag = (): CaptureDiag =>
      buildCaptureDiag({
        sawData: sawDataRef.current,
        capturedBytes: capturedBytesRef.current,
        chunkCount: chunksRef.current.length,
        chunksUploaded: uploadedRef.current,
        durationMs,
        mimeType: mimeTypeRef.current,
        recorderError: recorderErrorRef.current,
        trackEnded: trackEndedRef.current,
        trackMuted: trackMutedRef.current,
        track: streamRef.current?.getAudioTracks()[0] ?? null,
        wakeLockGranted: wakeLockGrantedRef.current,
        hiddenDuringRecording: hiddenDuringRef.current,
      });
    return new Promise((resolve) => {
      const chunksUploaded = uploadedRef.current;
      if (!rec || rec.state === "inactive") {
        resolve({ blob: null, durationMs, chunksUploaded, seq0Uploaded: seq0OkRef.current, diag: buildDiag() });
        return;
      }
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" })
          : null;
        resolve({ blob, durationMs, chunksUploaded: uploadedRef.current, seq0Uploaded: seq0OkRef.current, diag: buildDiag() });
      };
      try {
        rec.stop();
      } catch {
        resolve({ blob: null, durationMs, chunksUploaded, seq0Uploaded: seq0OkRef.current, diag: buildDiag() });
      }
    });
  }, [releaseWakeLock]);

  // Re-acquire the wake lock when the tab becomes visible again while still recording (mobile releases it on hide).
  // Also COUNT hidden transitions during a recording — a backgrounded tab is when iOS suspends the mic track, so
  // this is a prime suspect for a zero-audio pitch and belongs in the diagnostics.
  useEffect(() => {
    const onVisible = () => {
      const isRecording = recorderRef.current && recorderRef.current.state === "recording";
      if (document.visibilityState === "hidden") {
        if (isRecording) hiddenDuringRef.current += 1;
        return;
      }
      if (isRecording) void requestWakeLock();
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
      if (chunkForceRef.current) clearInterval(chunkForceRef.current);
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
      analyserStreamRef.current?.getTracks().forEach((t) => t.stop()); // the cloned analyser track
      void audioCtxRef.current?.close();
    };
  }, [releaseWakeLock]);

  return { armed, recording, level, elapsedMs, arm, start, stop, captureInterrupted };
}

export type UseDoorRecorder = ReturnType<typeof useDoorRecorder>;
