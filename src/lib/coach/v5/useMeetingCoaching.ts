import { useCallback, useEffect, useRef, useState } from "react";
import type { CueMode } from "@/lib/data/salesCoach";

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

export type MeetingCoachingStatus = "idle" | "connecting" | "live" | "error";
type MeetingTurn = { speaker: "participant"; text: string };

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

  // Live refs read by the stable STT/cue handlers.
  const turnsRef = useRef<MeetingTurn[]>([]);
  const autoCoachRef = useRef(autoCoach);
  autoCoachRef.current = autoCoach;
  const nearingEndRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppedRef = useRef(false);
  const unmountedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const cueInFlightRef = useRef(false);
  const lastCueAtRef = useRef(0);
  const micLevelRef = useRef(0);
  const startRef = useRef<(isReconnect?: boolean) => Promise<void>>(async () => {});

  // Free the STT TRANSPORT (socket + audio graph + context) but KEEP the mic stream. Used before a reconnect —
  // a reconnect rebuilds the socket/context/proc, so the old ones MUST be closed first or each drop leaks an
  // AudioContext + a socket (browsers cap live AudioContexts, so a flaky network eventually kills capture).
  const teardownTransport = useCallback(() => {
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
      if (live.length < MIN_TURNS && !force) return;
      if (!force && Date.now() - lastCueAtRef.current < CUE_COOLDOWN_MS) return;
      cueInFlightRef.current = true;
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
        if (!res.ok) return;
        const data = await res.json();
        const c = data?.cue ?? {};
        if (c.shouldCue && typeof c.cue === "string" && c.cue.length > 0) {
          lastCueAtRef.current = Date.now();
          setCurrentCue(c.cue);
          void speakCue(c.cue);
        }
      } catch {
        /* auto-cue stays silent on failure; a forced request just yields no cue */
      } finally {
        cueInFlightRef.current = false;
      }
    },
    [sessionId, cueMode, speakCue]
  );

  const start = useCallback(
    async (isReconnect = false) => {
      if (!isReconnect) {
        stoppedRef.current = false;
        setError(null);
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
        if (unmountedRef.current) return teardown();

        const tokRes = await fetch("/api/coach/sales-session/realtime-token", { method: "POST" });
        if (!tokRes.ok) throw new Error("Couldn't get a realtime token.");
        const { token } = await tokRes.json();
        if (unmountedRef.current) return teardown();

        let ctx: AudioContext;
        try {
          ctx = new AudioContext({ sampleRate: 16000 });
        } catch {
          ctx = new AudioContext();
        }
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        if (unmountedRef.current) return teardown();
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
          reconnectAttemptsRef.current = 0;
          setStatus("live");
        };
        ws.onerror = () => {
          setError("Realtime connection error.");
        };
        ws.onclose = (ev) => {
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
    [teardown, teardownTransport, invokeCue]
  );
  startRef.current = start;

  const stop = useCallback(() => {
    stoppedRef.current = true;
    teardown();
    setStatus("idle");
    setPartial("");
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
    error,
    micLevel,
    autoCoach,
    setAutoCoach,
    kind,
    start,
    stop,
    requestCue,
    markNearingEnd,
  };
}
