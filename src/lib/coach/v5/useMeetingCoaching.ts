import { useCallback, useEffect, useRef, useState } from "react";
import type { CueMode } from "@/lib/data/salesCoach";
import { persistRecording } from "@/lib/coach/v5/persistRecording";
import { reportCaptureDiag, buildCaptureDiag } from "@/lib/coach/captureDiag";

/**
 * useMeetingCoaching — the LIVE capture + cue loop for Meeting Coach (Team-Sync), sibling of useLiveCoaching but
 * DELIBERATELY SEPARATE (reuse-map: the sales hook's transport is intertwined with its 2-party loudness
 * attribution, which is wrong for an N-party meeting). This is a lean, self-contained transport:
 *   mic → Scribe v2 realtime STT (single-use token) → UNLABELED committed turns → the meeting cue endpoint
 *   (/api/coach/meeting-session/[id]/cue) → speak the cue to the earpiece via the shared /tts route.
 *
 * Zero changes to the sales hook (the live sales business is untouched). The two share only server routes
 * (realtime-token, tts) and the tiny pure PCM encoder below (duplicated rather than extracted, to avoid any
 * edit to the load-bearing sales file; a later refactor can share it once both are stable).
 *
 * A39 (attribution): a single-room mic gives no reliable per-speaker split, so every turn is UNLABELED
 * (speaker "participant") rather than a guessed one. The meeting brain's text monitors (drift / undecided /
 * unassigned-action / over-run) work on the words; its imbalance monitor degrades to silent without labels
 * (correct — never a confident-wrong dominance read). Diarization is a later enhancement (Decision #1).
 *
 * NOT unit-testable in the node env (mic / WebSocket / AudioContext React glue) — device confirmation required,
 * same as useLiveCoaching. The pure pieces it depends on (the strategy brains, the cue route, parseMeetingCue)
 * are tested separately.
 */

const SCRIBE_REALTIME_WS = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
// Don't auto-cue over a cue the facilitator is still hearing.
const CUE_COOLDOWN_MS = 4000;
// The understanding gate needs a little conversation before a cue means anything.
const MIN_TURNS = 2;
const MAX_RECONNECTS = 6;
// Refill the reconnect budget only after the socket proves STABLE (stays open this long). Resetting it the
// instant it opens lets an open-then-instant-drop provider loop forever, minting a token + churning an
// AudioContext each cycle (sales capture audit 2026-08-21; review finding #2).
const RECONNECT_STABLE_MS = 8000;
// Record the call audio in 15s slices. "The audio is the load-bearing artifact" (sales capture-crisis lesson):
// everything downstream can fail + regenerate, but only if the audio survived.
const AUDIO_CHUNK_MS = 15_000;

export type MeetingCoachingStatus = "idle" | "connecting" | "live" | "error";
type MeetingTurn = { speaker: "participant"; text: string };

/**
 * Upload one audio slice to the SHARED session audio-chunk route (a meeting session is a coaching_sessions row,
 * so the same route + stitch cron give it durable audio for free — no new server code). Fire-and-forget with ONE
 * idempotent retry (the route dedups on session+seq); seq 0 carries the webm header, so it matters most. The
 * clean-Stop persist below covers a Stopped call; the never-Stop case is stitched from these chunks by the cron.
 * Route path is sales-namespaced but session-generic (owner-gated on the coaching_sessions row).
 */
function postMeetingAudioChunk(sessionId: string, seq: number, blob: Blob): Promise<boolean> {
  const attempt = () =>
    fetch(`/api/coach/sales-session/${sessionId}/audio-chunk?seq=${seq}`, {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob,
    }).then((r) => {
      if (!r.ok) throw new Error(`chunk ${seq} HTTP ${r.status}`);
      return true;
    });
  // Resolve true iff a chunk actually landed (audit M4) — so the hook can tell the facilitator the truth about
  // whether the recording is durable, rather than an unconditional "saving now".
  return attempt().catch(
    () =>
      new Promise<boolean>((resolve) => {
        setTimeout(() => void attempt().then(() => resolve(true)).catch(() => resolve(false)), 1500);
      })
  );
}

/** Pure: a Float32 PCM frame → base64 16-bit PCM (Scribe's input_audio_chunk payload). Duplicated from the
 *  sales hook so this file needs no edit to that load-bearing one; behaviourally identical. */
function floatTo16BitPCMBase64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function useMeetingCoaching(sessionId: string, kind: "meeting" | "huddle") {
  const [status, setStatus] = useState<MeetingCoachingStatus>("idle");
  const [turns, setTurns] = useState<MeetingTurn[]>([]);
  const [partial, setPartial] = useState("");
  const [currentCue, setCurrentCue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [autoCoach, setAutoCoach] = useState(true);
  const [cueMode] = useState<CueMode>("suggestion");
  // Per-cue status so a forced/declined/failed "Coach me now" is never a dead button (review finding #3).
  const [cueStatus, setCueStatus] = useState("");
  // Recording durability (audit M4): null while a call is live / the clean-Stop persist is in flight; true once
  // ANY audio is durable (a landed chunk OR the clean-Stop full-blob persist); false only when a Stopped call
  // saved NOTHING — so the panel never promises a review over a silently-lost recording.
  const [recordingSaved, setRecordingSaved] = useState<boolean | null>(null);

  // Live refs read by the stable STT/cue handlers.
  const turnsRef = useRef<MeetingTurn[]>([]);
  const autoCoachRef = useRef(autoCoach);
  autoCoachRef.current = autoCoach;
  const nearingEndRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioSeqRef = useRef(0);
  // iOS Safari IGNORES MediaRecorder.start(timeslice) → no periodic chunks → the meeting recording is lost on iOS
  // (same class as the Door Log fix 34a8ab71). Force a chunk via requestData() when the timeslice hasn't delivered;
  // adaptive via lastAudioDataAt (INERT on non-iOS that honor timeslice), self-guarding off a stopped/null recorder.
  const chunkForceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAudioDataAtRef = useRef(0);
  // Count of chunks that actually landed in storage during the call (audit M4) — the durable-audio evidence the
  // clean-Stop persist falls back on. Accumulates across reconnects; reset only on a fresh start.
  const chunkOkRef = useRef(0);
  // Capture-blindness sweep (founder 2026-08-23): observe WHY the recorder yields no audio, and report a diag on a
  // meaningful-duration session that captured nothing. Reset on a fresh start.
  const captureSawDataRef = useRef(false);
  const captureRecorderErrorRef = useRef<string | null>(null);
  const captureTrackEndedRef = useRef(false);
  const captureTrackMutedRef = useRef(false);
  const captureStartedAtRef = useRef(0);
  const captureDiagSentRef = useRef(false);
  const stoppedRef = useRef(false);
  const unmountedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const cueInFlightRef = useRef(false);
  const lastCueAtRef = useRef(0);
  const micLevelRef = useRef(0);
  // Session epoch — bumped on each fresh start so a cue requested for a prior session can't be delivered into a
  // new one (review finding #1). Stable-open timer for the reconnect-budget refill (finding #2).
  const sessionEpochRef = useRef(0);
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<(isReconnect?: boolean) => Promise<void>>(async () => {});

  // Free the STT TRANSPORT (socket + audio graph + context) but KEEP the mic stream. Used before a reconnect —
  // a reconnect rebuilds the socket/context/proc, so the old ones MUST be closed first or each drop leaks an
  // AudioContext + a socket (browsers cap live AudioContexts, so a flaky network eventually kills capture).
  const teardownTransport = useCallback(() => {
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }
    try {
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;
        ws.close();
      }
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    try {
      procRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    procRef.current = null;
    try {
      void ctxRef.current?.close();
    } catch {
      /* ignore */
    }
    ctxRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    teardownTransport();
    // Stop the recorder BEFORE the mic tracks so its onstop fires with the captured chunks (→ clean-Stop persist).
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    if (chunkForceRef.current) { clearInterval(chunkForceRef.current); chunkForceRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [teardownTransport]);

  // Speak a cue to the earpiece via the shared TTS route (generic text→audio; reused unchanged from Sales).
  const speakCue = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/coach/sales-session/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const audio = await ctx.decodeAudioData(buf);
      const src = ctx.createBufferSource();
      src.buffer = audio;
      src.connect(ctx.destination);
      src.start();
    } catch {
      /* a TTS failure must never break capture */
    }
  }, []);

  // Ask the meeting brain for a cue over the rolling transcript. force = the facilitator tapped "coach me now".
  const invokeCue = useCallback(
    async (force: boolean) => {
      if (cueInFlightRef.current) return;
      const live = turnsRef.current;
      if (live.length < MIN_TURNS) {
        // Don't call the LLM on an empty room; a forced tap gets an honest message instead of a dead button.
        if (force) setCueStatus("Still listening — say a bit more, then ask again.");
        return;
      }
      if (!force && Date.now() - lastCueAtRef.current < CUE_COOLDOWN_MS) return;
      // Capture the epoch at request time; only deliver if we're still in the SAME session when it resolves.
      const epoch = sessionEpochRef.current;
      cueInFlightRef.current = true;
      if (force) setCueStatus("Thinking…");
      try {
        const res = await fetch(`/api/coach/meeting-session/${sessionId}/cue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: cueMode,
            force,
            nearingEnd: nearingEndRef.current,
            liveTranscript: live.slice(-12).map((t) => ({ speaker: t.speaker, text: t.text })),
          }),
        });
        if (!res.ok) {
          // Surface a forced failure honestly (§3.4 — never a silent dead button); auto-cues stay quiet. A rep
          // shouldn't see a raw HTTP status (audit D5) — show a plain, actionable line; keep the status in the
          // console for debugging.
          if (force) {
            console.error(`[meeting cue] forced cue failed — HTTP ${res.status}`);
            setCueStatus("Coach couldn't respond right now — try again in a moment.");
          }
          return;
        }
        const data = await res.json();
        const c = data?.cue ?? {};
        if (c.shouldCue && typeof c.cue === "string" && c.cue.length > 0) {
          if (epoch !== sessionEpochRef.current) return; // a new session started while this was in flight — drop it
          lastCueAtRef.current = Date.now();
          setCurrentCue(c.cue);
          setCueStatus("");
          void speakCue(c.cue);
        } else if (force) {
          setCueStatus("Coach had nothing pressing to add right now.");
        }
      } catch {
        if (force) setCueStatus("Cue request failed — check your connection.");
      } finally {
        cueInFlightRef.current = false;
      }
    },
    [sessionId, cueMode, speakCue]
  );

  const start = useCallback(
    async (isReconnect = false) => {
      if (!isReconnect) {
        // FRESH session — reset every per-session ref/state so nothing bleeds from a prior meeting in this same
        // mount (the panel keeps the hook mounted across endSession). Findings #1 (cue latch + epoch) and #4.
        stoppedRef.current = false;
        cueInFlightRef.current = false; // a prior in-flight cue must not block the new session's cues
        sessionEpochRef.current += 1; // a late cue from the prior session won't be delivered (checked in invokeCue)
        reconnectAttemptsRef.current = 0;
        nearingEndRef.current = false;
        lastCueAtRef.current = 0;
        micLevelRef.current = 0;
        chunkOkRef.current = 0; // fresh recording-durability accounting (audit M4)
        captureSawDataRef.current = false;
        captureRecorderErrorRef.current = null;
        captureTrackEndedRef.current = false;
        captureTrackMutedRef.current = false;
        captureDiagSentRef.current = false;
        captureStartedAtRef.current = 0;
        setRecordingSaved(null);
        setError(null);
        setCurrentCue(null);
        setCueStatus("");
        setMicLevel(0);
        turnsRef.current = [];
        setTurns([]);
      } else {
        // Close the dropped socket + its audio graph/context before rebuilding — else each reconnect orphans an
        // AudioContext + socket. Keep the mic stream (re-acquiring after a background/lock often fails or hangs).
        teardownTransport();
      }
      setStatus("connecting");
      const scheduleReconnect = (): boolean => {
        if (stoppedRef.current || unmountedRef.current || reconnectAttemptsRef.current >= MAX_RECONNECTS) {
          return false;
        }
        reconnectAttemptsRef.current += 1;
        setTimeout(() => {
          if (stoppedRef.current || unmountedRef.current) return;
          void startRef.current(true);
        }, 500 * reconnectAttemptsRef.current);
        return true;
      };
      try {
        const stream =
          isReconnect && streamRef.current?.getAudioTracks().some((t) => t.readyState === "live")
            ? streamRef.current
            : await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        if (unmountedRef.current || stoppedRef.current) return teardown();

        // Record the call audio — FRESH START only. One recorder for the whole call = one valid webm (no
        // mid-stream seam to reason about). On a reconnect the existing recorder keeps running on the reused
        // stream; if the mic track died and a new stream was acquired, post-loss audio isn't recorded (accepted
        // MVP limit — the full recorder-recreate seam handling is a later refinement, see the client closure).
        if (!isReconnect) {
          chunksRef.current = [];
          audioSeqRef.current = 0;
          captureStartedAtRef.current = Date.now();
          // Capture-blindness sweep: watch the mic track dying mid-call (screen-lock / DND / a call / another app).
          const micTrack = stream.getAudioTracks()[0];
          if (micTrack) {
            micTrack.onended = () => { captureTrackEndedRef.current = true; };
            micTrack.onmute = () => { captureTrackMutedRef.current = true; };
          }
          try {
            const rec = new MediaRecorder(stream);
            rec.onerror = (e: Event) => {
              const err = (e as unknown as { error?: { name?: string; message?: string } }).error;
              captureRecorderErrorRef.current = err?.name || err?.message || "MediaRecorder error";
            };
            rec.ondataavailable = (e) => {
              lastAudioDataAtRef.current = Date.now(); // timeslice IS delivering → the force-interval stays a no-op
              if (e.data.size === 0) return;
              captureSawDataRef.current = true;
              chunksRef.current.push(e.data);
              // durable during the call; track whether it actually landed so Stop can tell the truth (M4)
              void postMeetingAudioChunk(sessionId, audioSeqRef.current++, e.data).then((ok) => {
                if (ok) chunkOkRef.current += 1;
              });
            };
            rec.onstop = () => {
              const all = chunksRef.current;
              const blob = all.length ? new Blob(all, { type: all[0]?.type || "audio/webm" }) : null;
              // Capture-blindness sweep: a meaningful-duration meeting that captured NOTHING (no blob AND no chunk
              // landed) is a real failure — report the ground-truth cause. Once per session.
              const dur = captureStartedAtRef.current ? Date.now() - captureStartedAtRef.current : 0;
              if (!blob && chunkOkRef.current === 0 && dur > 3000 && !captureDiagSentRef.current) {
                captureDiagSentRef.current = true;
                reportCaptureDiag(
                  "meeting",
                  buildCaptureDiag({
                    sawData: captureSawDataRef.current,
                    chunkCount: 0,
                    chunksUploaded: chunkOkRef.current,
                    durationMs: dur,
                    mimeType: rec.mimeType,
                    recorderError: captureRecorderErrorRef.current,
                    trackEnded: captureTrackEndedRef.current,
                    trackMuted: captureTrackMutedRef.current,
                    track: streamRef.current?.getAudioTracks()[0] ?? null,
                  }),
                  sessionId,
                );
              }
              if (blob) {
                // Clean-Stop full-blob persist (stamps audio_asset_url). On success the recording is durable; on
                // failure it's durable ONLY if a chunk already landed — otherwise the review would be a false
                // promise, so surface that honestly (audit M4).
                void persistRecording(sessionId, blob)
                  .then(() => {
                    if (!unmountedRef.current) setRecordingSaved(true);
                  })
                  .catch(() => {
                    if (!unmountedRef.current) setRecordingSaved(chunkOkRef.current > 0);
                  });
              } else if (!unmountedRef.current) {
                // No full blob captured — durability rests entirely on whatever chunks streamed live.
                setRecordingSaved(chunkOkRef.current > 0);
              }
            };
            rec.start(AUDIO_CHUNK_MS);
            lastAudioDataAtRef.current = Date.now();
            // Force a chunk when the timeslice hasn't delivered (iOS). requestData() flushes only the delta (no dup);
            // its blob is a valid webm continuation chunk the upload path already handles. Cleared in teardown().
            if (chunkForceRef.current) clearInterval(chunkForceRef.current);
            chunkForceRef.current = setInterval(() => {
              const r = recorderRef.current;
              if (!r || r.state !== "recording") return;
              if (Date.now() - lastAudioDataAtRef.current >= AUDIO_CHUNK_MS) {
                try { r.requestData(); } catch { /* unsupported → the clean-Stop blob remains the fallback */ }
              }
            }, AUDIO_CHUNK_MS);
            recorderRef.current = rec;
          } catch {
            /* a recorder failure must never block live coaching — the transcript + cues still run */
          }
        }

        const tokRes = await fetch("/api/coach/sales-session/realtime-token", { method: "POST" });
        if (!tokRes.ok) throw new Error("Couldn't get a realtime token.");
        const { token } = await tokRes.json();
        if (unmountedRef.current || stoppedRef.current) return teardown();

        let ctx: AudioContext;
        try {
          ctx = new AudioContext({ sampleRate: 16000 });
        } catch {
          ctx = new AudioContext();
        }
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        if (unmountedRef.current || stoppedRef.current) return teardown();
        const sr = Math.round(ctx.sampleRate);

        const ws = new WebSocket(
          `${SCRIBE_REALTIME_WS}?token=${encodeURIComponent(token)}` +
            `&model_id=scribe_v2_realtime&commit_strategy=vad&audio_format=pcm_${sr}`
        );
        wsRef.current = ws;

        const source = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        source.connect(proc);
        // Muted gain keeps the ScriptProcessor alive without echoing the room to the speakers.
        const muteGain = ctx.createGain();
        muteGain.gain.value = 0;
        proc.connect(muteGain);
        muteGain.connect(ctx.destination);

        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          let sumSq = 0;
          for (let i = 0; i < input.length; i += 1) sumSq += (input[i] ?? 0) ** 2;
          const rms = Math.sqrt(sumSq / Math.max(1, input.length));
          micLevelRef.current = micLevelRef.current * 0.6 + Math.min(1, rms / 0.2) * 0.4;
          setMicLevel(micLevelRef.current);
          try {
            ws.send(
              JSON.stringify({
                message_type: "input_audio_chunk",
                audio_base_64: floatTo16BitPCMBase64(input),
                sample_rate: sr,
              })
            );
          } catch {
            /* a dropped send is recovered by the next frame / reconnect */
          }
        };

        let wsOpened = false;
        ws.onopen = () => {
          wsOpened = true;
          // Refill the reconnect budget only once the socket proves STABLE (open ≥ RECONNECT_STABLE_MS). The timer
          // is cleared on close/teardown, so an open-then-instant-drop never refills → the loop can't run forever.
          if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
          stableTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current = 0;
          }, RECONNECT_STABLE_MS);
          setStatus("live");
        };
        ws.onerror = () => {
          setError("Realtime connection error.");
        };
        ws.onclose = (ev) => {
          // A drop before the stable timer fires must NOT refill the budget — clear it so a flapping socket
          // exhausts MAX_RECONNECTS and surfaces the error instead of reconnecting forever.
          if (stableTimerRef.current) {
            clearTimeout(stableTimerRef.current);
            stableTimerRef.current = null;
          }
          if (stoppedRef.current || unmountedRef.current) return;
          if (scheduleReconnect()) return;
          setError(
            wsOpened
              ? "Live transcription dropped and couldn't reconnect. Tap Stop and restart to resume coaching."
              : `Couldn't connect to live transcription (code ${ev.code}).`
          );
          setStatus("error");
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
            setPartial("");
            const text = (msg.text ?? "").trim();
            if (!text) return;
            const turn: MeetingTurn = { speaker: "participant", text };
            turnsRef.current = [...turnsRef.current, turn];
            setTurns(turnsRef.current);
            if (autoCoachRef.current) void invokeCue(false);
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start meeting coaching.");
        setStatus("error");
        teardown();
      }
    },
    [teardown, teardownTransport, invokeCue, sessionId]
  );
  startRef.current = start;

  const stop = useCallback(() => {
    stoppedRef.current = true;
    teardown();
    setStatus("idle");
    setPartial("");
    setCurrentCue(null);
    setCueStatus("");
    setMicLevel(0);
  }, [teardown]);

  const requestCue = useCallback(() => void invokeCue(true), [invokeCue]);
  const markNearingEnd = useCallback((v: boolean) => {
    nearingEndRef.current = v;
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      teardown();
    };
  }, [teardown]);

  return {
    status,
    turns,
    partial,
    currentCue,
    cueStatus,
    error,
    micLevel,
    autoCoach,
    setAutoCoach,
    kind,
    start,
    stop,
    requestCue,
    markNearingEnd,
    recordingSaved,
  };
}
