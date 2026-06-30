"use client";

import { useCallback, useRef, useState } from "react";
import type { CueMode, TranscriptSpeaker } from "@/lib/data/salesCoach";

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
// Endpointing: Scribe's VAD commits a transcript at end-of-utterance, so a
// committed_transcript already means "they paused". This short SETTLE on
// top coalesces burst-commits within one turn (e.g. "I think…" then "…next
// month") before we cue — the tunable silence gate (Increment 3 tunes it).
// Replaces the old blanket 4s debounce that cued regardless of who spoke.
const TURN_SETTLE_MS = 700;
// Minimal anti-double-fire guard ONLY (founder 2026-06-30: 25s was "way
// too long" — the coach must cue on EVERY prospect turn-end with little
// delay). The conversation paces itself: cues fire only on prospect turns,
// and cueInFlight blocks overlap — so one cue per prospect turn is the
// natural rate. This short window only stops a stray late commit from
// re-firing the SAME turn's cue. On-demand ("coach me") bypasses it.
// Tunable.
const CUE_COOLDOWN_MS = 3000;

// Volume/proximity attribution (founder 2026-06-30): the salesperson wears
// the mic, so their speech is LOUDER than the prospect across the room. NOT
// voice-ID — it's loudness/distance. Per-frame RMS below this is treated as
// silence/noise, not speech. Tunable defaults (Increment 3 tunes them).
const VOICE_NOISE_FLOOR = 0.004;
// When only the salesperson's level is known yet, an utterance quieter than
// this fraction of it is taken to be the (farther) prospect.
const QUIET_RATIO = 0.65;

// A single attributed turn. Salesperson = "agent", prospect = "customer"
// (the existing TranscriptSpeaker terms). `pending` = the instant
// provisional label is showing; the content classifier hasn't returned yet.
type Turn = { text: string; speaker: TranscriptSpeaker; pending?: boolean };

/**
 * Proximity verdict from an utterance's mean loudness — the INSTANT,
 * content-independent provisional label (replaces the old alternation
 * guess). The salesperson is nearer the mic → louder. Adaptive: anchors
 * the first speaker as the salesperson (door-to-door, they open), learns
 * each side's level (EMA), and classifies later turns by nearest level.
 * Combined WITH (not replacing) the content classifier. Honest limit:
 * assumes the mic is AGENT-WORN; a table-placed mic breaks it.
 */
function volumeVerdict(
  energy: number,
  agentLevel: number | null,
  customerLevel: number | null
): {
  speaker: TranscriptSpeaker;
  agentLevel: number | null;
  customerLevel: number | null;
} {
  if (energy <= 0) return { speaker: "agent", agentLevel, customerLevel };
  // Anchor: first speaker = salesperson; seed the loud/near level.
  if (agentLevel === null) {
    return { speaker: "agent", agentLevel: energy, customerLevel };
  }
  let speaker: TranscriptSpeaker;
  if (customerLevel === null) {
    speaker = energy < agentLevel * QUIET_RATIO ? "customer" : "agent";
  } else {
    speaker =
      Math.abs(energy - agentLevel) <= Math.abs(energy - customerLevel)
        ? "agent"
        : "customer";
  }
  const ema = (prev: number | null) =>
    prev === null ? energy : prev * 0.7 + energy * 0.3;
  return {
    speaker,
    agentLevel: speaker === "agent" ? ema(agentLevel) : agentLevel,
    customerLevel: speaker === "customer" ? ema(customerLevel) : customerLevel,
  };
}

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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState("");
  const [currentCue, setCurrentCue] = useState<string | null>(null);
  const [mode, setMode] = useState<CueMode>("suggestion");
  const [error, setError] = useState<string | null>(null);
  // Visible cue lifecycle so failures show ON SCREEN, not just console
  // (the audio-cue debugging, 2026-06-27).
  const [cueStatus, setCueStatus] = useState<string>("");
  // Auto-coach toggle (founder request 2026-06-27): when ON, the coach
  // cues automatically at pauses — no pressing "coach me now". When OFF,
  // it stays quiet (transcript still runs). Default ON.
  const [autoCoach, setAutoCoachState] = useState(true);
  // F2: the recorded call audio, available after Stop, to feed the S1a
  // upload→diarize→label→review pipeline so a live session leaves a
  // persisted, reviewable record (§1.1). In-person only — the mic holds
  // both voices in a room; online video, it's agent-only.
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  // #1 fix (2026-06-30): the live attributed turns (volume+content
  // speaker-separated) are persisted as the canonical transcript on Stop —
  // batch diarization can't separate a single far mic, so it collapsed
  // everything to "agent". True once the live transcript is saved.
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  // Live mic-level meter (0–1, smoothed) so the agent can SEE their volume —
  // it's the same RMS that drives proximity attribution, so a high bar when
  // they speak confirms they're the louder/near voice.
  const [micLevel, setMicLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueInFlightRef = useRef(false);
  const modeRef = useRef<CueMode>("suggestion");
  const lastCueAtRef = useRef(0); // F4 cooldown (ms epoch); 0 = never
  const autoCoachRef = useRef(true); // mirrors autoCoach for ws closures
  // Volume/proximity attribution: per-utterance energy accumulator + the
  // learned loudness level for each side (salesperson near/loud, prospect
  // far/quiet).
  const utterEnergyRef = useRef<{ sum: number; count: number }>({
    sum: 0,
    count: 0,
  });
  const agentLevelRef = useRef<number | null>(null);
  const customerLevelRef = useRef<number | null>(null);
  const micLevelRef = useRef(0); // smoothing accumulator for the meter

  // Speak a cue privately to the agent (reuses Jeff's flash TTS).
  const speakCue = useCallback(async (text: string) => {
    try {
      setCueStatus("Speaking…");
      // Agent-authed TTS — NOT /api/care/tts (that needs a customer
      // x-care-session token → 401 on the dashboard, the "no cue audio"
      // root cause, 2026-06-27).
      const res = await fetch("/api/coach/sales-session/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let detail = raw.slice(0, 160);
        try {
          detail = (JSON.parse(raw)?.error as string) ?? detail;
        } catch {
          /* keep raw */
        }
        setCueStatus(`Couldn't voice the cue (TTS ${res.status}): ${detail}`);
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] cue TTS request failed", res.status, detail);
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
      node.onended = () => setCueStatus("");
      node.start();
      // F3 (audit 2026-06-27): starting playback ≠ audible. Don't assert
      // they heard it — point at the output device if they didn't.
      setCueStatus("🔊 Cue sent to your earpiece — check your output if you don't hear it.");
    } catch (err) {
      setCueStatus(
        `Couldn't play the cue audio: ${err instanceof Error ? err.message : String(err)}. The text is shown above.`
      );
      // eslint-disable-next-line no-console
      console.warn("[live-coaching] cue TTS failed", err);
    }
  }, []);

  // onDemand bypasses the F4 cooldown (the agent explicitly asked).
  const invokeCue = useCallback(
    async (onDemand = false) => {
      if (cueInFlightRef.current) return;
      const live = turnsRef.current;
      if (live.length < 2) {
        // "Coach me now" shouldn't feel dead when there's nothing to read
        // yet (image 1: button did nothing).
        if (onDemand) {
          setCueStatus("Still listening — say a bit more, then ask again.");
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
      if (onDemand) setCueStatus("Thinking…");
      try {
        const res = await fetch(`/api/coach/sales-session/${sessionId}/cue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: modeRef.current,
            // force=true for BOTH auto and on-demand: when auto-coach is
            // ON, the agent has opted into ACTIVE guidance, so the coach
            // should proactively cue at prospect pauses — not sit behind
            // the §3.3 "stay silent unless high-value" gate that made
            // auto-coach feel dead (founder, 2026-06-30). force is softened
            // (it may still honestly defer if there's truly nothing), and
            // the 25s cooldown bounds AUTO frequency so it never spams.
            // On-demand additionally bypasses the cooldown (below).
            force: true,
            // Attributed turns (Increment 1 naive attribution) — the brain
            // now reads WHO said what, not an undifferentiated stream.
            liveTranscript: live.slice(-12).map((t) => ({
              speaker: t.speaker,
              text: t.text,
            })),
          }),
        });
        if (!res.ok) {
          if (onDemand) setCueStatus(`Cue request failed (${res.status}).`);
          return;
        }
        const data = await res.json();
        // eslint-disable-next-line no-console
        console.info("[live-coaching] cue result", {
          shouldCue: data?.cue?.shouldCue,
          hasText: Boolean(data?.cue?.cue),
        });
        if (data?.cue?.shouldCue && data.cue.cue) {
          lastCueAtRef.current = Date.now(); // start the cooldown
          setCurrentCue(data.cue.cue);
          void speakCue(data.cue.cue);
        } else if (onDemand) {
          // force was on, so this is rare — but don't leave the button dead.
          setCueStatus("Coach had nothing pressing to add right now.");
        }
      } catch (err) {
        if (onDemand) setCueStatus("Cue request failed — see console.");
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

  // Content-classify a just-committed turn (Increment 2). Replaces the
  // provisional label with the real, CONTENT-based one, then — and only
  // then — decides whether to jump in. The cue trigger is gated on the
  // CONTENT label, so a wrong provisional label never produces a wrong cue.
  const classifyTurn = useCallback(
    async (
      index: number,
      text: string,
      priorSpeaker: TranscriptSpeaker,
      volHint: TranscriptSpeaker
    ) => {
      const settleLabel = (speaker: TranscriptSpeaker | null) => {
        turnsRef.current = turnsRef.current.map((t, i) =>
          i === index
            ? { ...t, speaker: speaker ?? t.speaker, pending: false }
            : t
        );
        setTurns(turnsRef.current);
      };
      try {
        const before = turnsRef.current.slice(Math.max(0, index - 6), index);
        const res = await fetch("/api/coach/sales-session/attribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recentTurns: before.map((t) => ({ speaker: t.speaker, text: t.text })),
            latestText: text,
            priorSpeaker,
            // The proximity prior — loud=salesperson, quiet=prospect.
            volumeHint: volHint,
          }),
        });
        let speaker: TranscriptSpeaker | null = null;
        let dbg = res.ok ? "" : `http=${res.status}`;
        if (res.ok) {
          const j = await res.json();
          dbg = (j?.debug as string) ?? "";
          if (j?.speaker === "agent" || j?.speaker === "customer") {
            speaker = j.speaker;
          }
        }
        // Final label = content if the classifier produced one, else the
        // volume verdict (the provisional already on the turn). So a null
        // content result now falls back to LOUDNESS, not an alternation guess.
        settleLabel(speaker);
        const finalSpeaker = speaker ?? turnsRef.current[index]?.speaker;
        // eslint-disable-next-line no-console
        console.info(
          `[live-coaching] turn #${index + 1} vol=${volHint} content=${speaker ?? "(null→kept vol)"} → ${finalSpeaker} | ${dbg}`
        );
        // Jump in ONLY if the prospect spoke AND this is still the latest
        // turn (a newer commit supersedes — it'll run its own trigger).
        if (
          finalSpeaker === "customer" &&
          index === turnsRef.current.length - 1 &&
          autoCoachRef.current
        ) {
          if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
          cueTimerRef.current = setTimeout(() => void invokeCue(), TURN_SETTLE_MS);
        }
      } catch {
        settleLabel(null); // keep provisional, clear the pending flag
      }
    },
    [invokeCue]
  );

  const stop = useCallback(() => {
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    // #1 fix: persist the live attributed transcript (speaker-separated)
    // before teardown. This is the canonical transcript for in-person —
    // append-only, best-effort. A failure just leaves the recording-upload
    // fallback available.
    const captured = turnsRef.current;
    if (captured.length > 0) {
      void fetch(`/api/coach/sales-session/${sessionId}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: captured.map((t, i) => ({
            speaker: t.speaker,
            text: t.text,
            seq: i,
          })),
        }),
      })
        .then((r) => {
          if (r.ok) {
            setTranscriptSaved(true);
            // Auto-generate the dissect so the admin's Coach Assessment
            // view fills in without anyone clicking (founder 2026-06-30).
            // Best-effort, fire-and-forget — runs on the just-saved
            // transcript. The dissect itself returns the honest empty state
            // if the session was too thin.
            void fetch(`/api/coach/sales-session/dissect`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            }).catch(() => {});
            // Auto-generate the distinct factual conversation summary too
            // (founder 2026-06-30) — persisted + shown on the session.
            void fetch(
              `/api/coach/sales-session/${sessionId}/summarize`,
              { method: "POST" }
            ).catch(() => {});
          }
        })
        .catch(() => {
          /* fallback: the recording-upload path stays available */
        });
    }
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
    micLevelRef.current = 0;
    setMicLevel(0);
  }, [sessionId]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setTurns([]);
    turnsRef.current = [];
    setTranscriptSaved(false);
    utterEnergyRef.current = { sum: 0, count: 0 };
    agentLevelRef.current = null;
    customerLevelRef.current = null;
    micLevelRef.current = 0;
    setMicLevel(0);
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
      // F2 (audit 2026-06-27): keep the ScriptProcessor alive via a MUTED
      // gain node instead of wiring the mic straight to the speakers —
      // proc->destination echoed the agent's own voice (and fed the cue
      // back into the mic on speakers). gain 0 = no output, but the node
      // still processes + sends audio over the websocket.
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;
      proc.connect(muteGain);
      muteGain.connect(ctx.destination);

      let sentChunks = 0;
      proc.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        // Per-frame RMS for proximity attribution. Only frames above the
        // noise floor count, so silence between words doesn't dilute the
        // utterance's loudness.
        let sumSq = 0;
        for (let i = 0; i < input.length; i += 1) {
          const s = input[i] ?? 0;
          sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, input.length));
        if (rms > VOICE_NOISE_FLOOR) {
          utterEnergyRef.current.sum += rms;
          utterEnergyRef.current.count += 1;
        }
        // Live meter (same RMS): scale so normal speech fills most of the
        // bar, then EMA-smooth so it glides instead of flickering.
        const lvl = Math.min(1, rms / 0.2);
        micLevelRef.current = micLevelRef.current * 0.6 + lvl * 0.4;
        setMicLevel(micLevelRef.current);
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
          // Close out the utterance's loudness, whether or not there's text.
          const acc = utterEnergyRef.current;
          const energy = acc.count > 0 ? acc.sum / acc.count : 0;
          utterEnergyRef.current = { sum: 0, count: 0 };
          if (!text) return;
          // Proximity verdict (instant, content-independent) — the provisional
          // label AND the prior fed to the content classifier.
          const v = volumeVerdict(
            energy,
            agentLevelRef.current,
            customerLevelRef.current
          );
          agentLevelRef.current = v.agentLevel;
          customerLevelRef.current = v.customerLevel;
          const priorSpeaker =
            turnsRef.current[turnsRef.current.length - 1]?.speaker ?? "agent";
          const index = turnsRef.current.length;
          turnsRef.current = [
            ...turnsRef.current,
            { text, speaker: v.speaker, pending: true },
          ];
          setTurns(turnsRef.current);
          // eslint-disable-next-line no-console
          console.info(
            `[live-coaching] turn #${index + 1} committed (energy=${energy.toFixed(4)} vol=${v.speaker}): "${text.slice(0, 80)}"`
          );
          // A new commit cancels any pending cue (the salesperson didn't
          // wait for it). The cue trigger lives in classifyTurn, gated on
          // the final (content-or-volume) label.
          if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
          void classifyTurn(index, text, priorSpeaker, v.speaker);
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      stop();
    }
  }, [invokeCue, status, stop, classifyTurn]);

  const updateMode = useCallback((m: CueMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  const setAutoCoach = useCallback((on: boolean) => {
    autoCoachRef.current = on;
    setAutoCoachState(on);
    if (!on && cueTimerRef.current) clearTimeout(cueTimerRef.current);
  }, []);

  const clearRecording = useCallback(() => setRecordingBlob(null), []);

  return {
    recordingBlob,
    clearRecording,
    transcriptSaved,
    micLevel,
    status,
    turns,
    partial,
    currentCue,
    cueStatus,
    autoCoach,
    setAutoCoach,
    mode,
    setMode: updateMode,
    error,
    start,
    stop,
    requestCue,
  };
}
