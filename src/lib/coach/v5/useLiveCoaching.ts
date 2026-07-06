"use client";

import { useCallback, useRef, useState } from "react";
import type { CueMode, TranscriptSpeaker, SalesContext } from "@/lib/data/salesCoach";
import {
  isFillerSpike,
  turnWpm,
  updatePaceBaseline,
  isPaceSpike,
  type PaceBaseline,
} from "@/lib/coach/v5/liveStress";
import { detectF0, PitchSeparator } from "@/lib/coach/v5/pitchSeparation";
import {
  guessSpeakerFromContent,
  composeProvisional,
} from "@/lib/coach/v5/speakerAttribution";
import {
  shouldScheduleCueAtCommit,
  reconcileCueAfterClassify,
} from "@/lib/coach/v5/cueCoordination";
import {
  computeConfidence,
  type ConfidenceRead,
} from "@/lib/coach/v5/liveConfidence";

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
// F2 (audit 2026-07-01) — the stress cue gets its OWN, much longer cooldown:
// nudging a nervous rep about their nerves every few seconds would INCREASE
// stress (§3.3 over-cue) and hit the LLM on every spike (§5). Gated client-
// side BEFORE the call, so one steadying nudge per episode, cost bounded.
const STRESS_COOLDOWN_MS = 45000;
// Stall detection (tester feedback 2026-07-01): if the conversation goes
// quiet this long with no new speech, offer the brain a chance to nudge —
// but only if the last read phase wasn't a close (that silence is sacred).
const STALL_MS = 45_000;

// Volume/proximity attribution (founder 2026-06-30): the salesperson wears
// the mic, so their speech is LOUDER than the prospect across the room. NOT
// voice-ID — it's loudness/distance. Per-frame RMS below this is treated as
// silence/noise, not speech. Tunable defaults (Increment 3 tunes them).
const VOICE_NOISE_FLOOR = 0.004;
// A pitch cluster this confident (0..1) overrides the loudness guess for the
// provisional label; below it we defer to loudness (§3.4 — trust pitch only
// once the two clusters are actually separated).
const PITCH_TRUST = 0.5;
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
  customerLevel: number | null,
  override: TranscriptSpeaker | null = null
): {
  speaker: TranscriptSpeaker;
  agentLevel: number | null;
  customerLevel: number | null;
} {
  if (energy <= 0) return { speaker: override ?? "agent", agentLevel, customerLevel };
  // (a) Ground truth — the rep toggled "I'm speaking". Trust the label AND
  // anchor that side's level HARD (0.5 weight vs 0.3 for a guess) so every
  // later unmarked turn's near/far decision is measured against the rep's REAL
  // level, not a first-speaker assumption (§1 — the correction trains the
  // auto path). NOTE (§4): a candidate improvement — unvalidated until the
  // accuracy log + a live call confirm it.
  if (override) {
    const ground = (prev: number | null) =>
      prev === null ? energy : prev * 0.5 + energy * 0.5;
    return {
      speaker: override,
      agentLevel: override === "agent" ? ground(agentLevel) : agentLevel,
      customerLevel:
        override === "customer" ? ground(customerLevel) : customerLevel,
    };
  }
  // Anchor: seed the loud/near level from the first utterance (provisional).
  if (agentLevel === null) {
    return { speaker: "agent", agentLevel: energy, customerLevel };
  }
  let aLevel = agentLevel;
  let cLevel = customerLevel;
  // (b) Louder = agent. In-person the rep holds the mic (near/loud); the
  // prospect is across the doorstep (far/quiet). If the "customer" cluster is
  // clearly louder than the "agent" one, the first-speaker seed was inverted
  // (e.g. the prospect opened the door) — swap so the agent is the louder
  // voice. The 1.15 margin stops it flapping when the two are close. NOTE
  // (§4): a fallible physical prior (a loud prospect breaks it) — candidate,
  // not proven; the content classifier + toggle carry the ambiguous cases.
  if (cLevel !== null && cLevel > aLevel * 1.15) {
    const t = aLevel;
    aLevel = cLevel;
    cLevel = t;
  }
  let speaker: TranscriptSpeaker;
  if (cLevel === null) {
    speaker = energy < aLevel * QUIET_RATIO ? "customer" : "agent";
  } else {
    speaker =
      Math.abs(energy - aLevel) <= Math.abs(energy - cLevel)
        ? "agent"
        : "customer";
  }
  const ema = (prev: number | null) =>
    prev === null ? energy : prev * 0.7 + energy * 0.3;
  return {
    speaker,
    agentLevel: speaker === "agent" ? ema(aLevel) : aLevel,
    customerLevel: speaker === "customer" ? ema(cLevel) : cLevel,
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

/** A short earcon to the rep's output when they toggle "I'm speaking" (founder
 *  2026-07-03) — the rep holds the earbud as a mic, off-ear, so a tap gives no
 *  visual/tactile confirmation. ON = a quick rising tone; OFF = a falling one,
 *  so the STATE is distinguishable by ear. Kept short + moderate (the earbud is
 *  near the prospect — §3.4). Best-effort; silent if Web Audio is unavailable. */
function playToggleBeep(on: boolean) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume?.().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(on ? 620 : 880, t0);
    osc.frequency.linearRampToValueAtTime(on ? 940 : 500, t0 + 0.14);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.start(t0);
    osc.stop(t0 + 0.2);
    osc.onended = () => {
      try {
        void ctx.close();
      } catch {
        /* no-op */
      }
    };
  } catch {
    /* audio unavailable — no-op */
  }
}

export function useLiveCoaching(sessionId: string, context?: SalesContext) {
  // Mode drives attribution: in-person = one mic holds both voices (attribute
  // agent vs prospect); video = mic is AGENT-ONLY (prospect is on the far end).
  // Held in a ref so the stable commit handler reads the current value.
  const contextRef = useRef(context);
  contextRef.current = context;
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState("");
  const [currentCue, setCurrentCue] = useState<string | null>(null);
  // After Pitch Summary cue loop (0080): the rep can confirm they USED the
  // current cue (source='rep_marked'), which the summary prefers over any
  // inference. cueMarked reflects that the current cue was confirmed.
  const [cueMarked, setCueMarked] = useState(false);
  const [mode, setMode] = useState<CueMode>("suggestion");
  const [error, setError] = useState<string | null>(null);
  // Visible cue lifecycle so failures show ON SCREEN, not just console
  // (the audio-cue debugging, 2026-06-27).
  const [cueStatus, setCueStatus] = useState<string>("");
  // Auto-coach toggle (founder request 2026-06-27): when ON, the coach
  // cues automatically at pauses — no pressing "coach me now". When OFF,
  // it stays quiet (transcript still runs). Default ON.
  const [autoCoach, setAutoCoachState] = useState(true);
  // Manual speaker override (founder 2026-07-03): a TOGGLE the rep drives with
  // a single earbud tap. When ON, every committed utterance is locked to
  // "agent" — a hard override of the loudness/content guess — for clean script
  // separation on the rep's turns. OFF = the automatic attribution runs.
  const [agentSpeaking, setAgentSpeaking] = useState(false);
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
  // The coach's current read of the conversation phase (§3.6 — make its
  // understanding visible). Null until the brain has read a moment.
  const [phase, setPhase] = useState<string | null>(null);
  // Build 4 — the current signal-based confidence read (§3.6), or null.
  const [confidence, setConfidence] = useState<ConfidenceRead | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The turn index whose cue clock was started AT COMMIT by an obvious content
  // tell (before the LLM /attribute returned) — so classifyTurn doesn't reset
  // the timer and re-add the latency we just saved (L2 response time). -1 = none.
  const cueScheduledAtCommitRef = useRef(-1);
  const cueInFlightRef = useRef(false);
  const modeRef = useRef<CueMode>("suggestion");
  const lastCueAtRef = useRef(0); // F4 cooldown (ms epoch); 0 = never
  const currentCueIdRef = useRef<string | null>(null); // DB id of the shown cue
  const lastStressCueAtRef = useRef(0); // F2 — stress-cue cooldown (ms epoch)
  const autoCoachRef = useRef(true); // mirrors autoCoach for ws closures
  const agentSpeakingRef = useRef(false); // mirrors agentSpeaking for ws closure
  // Separation-accuracy tally (§4/§3.6): auto-guess vs the toggle's ground
  // truth — turns "is separation better?" into a number we can watch.
  const sepAgreeRef = useRef(0);
  const sepTotalRef = useRef(0);
  const pitchAgreeRef = useRef(0);
  // Pitch-based acoustic separation (founder 2026-07-06) — a composing signal
  // alongside loudness + content (§A16). Fed per-frame F0; labels each committed
  // utterance by its pitch cluster with an honest confidence (§3.4).
  const pitchSepRef = useRef(new PitchSeparator());
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
  // The coach's last read of the phase — shown to the agent (§3.6) and used
  // to keep the stall timer from breaking a sacred post-close silence.
  const lastPhaseRef = useRef<string | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Build 3 — measurable stress. utteranceStart marks when the CURRENT
  // utterance began (first partial after a commit) → wall-clock speaking
  // duration for pace. paceBaseline is the rep's OWN rolling WPM norm.
  const utteranceStartRef = useRef<number | null>(null);
  const paceBaselineRef = useRef<PaceBaseline>({ mean: 0, count: 0 });
  // Build 4 — confidence read: a rolling window of the rep's recent stress
  // flags, aggregated (with talk-ratio) into a coarse, signal-based read.
  const recentStressRef = useRef<{ filler: boolean; pace: boolean }[]>([]);
  // Latest confidence read, for the cue brain (Option 3 — a hint, not a gate).
  const confidenceRef = useRef<ConfidenceRead | null>(null);

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

  // onDemand bypasses the cooldown + forces a response (the agent asked).
  // stall = the client's silence timer fired. stress = MEASURED filler/pace
  // spike on the rep's turn (build 3); still cooldown-gated + brain-decided.
  const invokeCue = useCallback(
    async (
      onDemand = false,
      stall = false,
      stress?: { fillerSpike: boolean; paceSpike: boolean }
    ) => {
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
            // §3.3 RESTRAINT (tester feedback 2026-07-01, reversing the
            // 2026-06-30 force-every-turn): AUTO cues go through the
            // understanding gate — the brain reads the phase and stays
            // silent unless phase + a high-value trigger align. Only
            // on-demand ("coach me now") forces a response.
            force: onDemand,
            // The client's stall timer fired (long silence). The brain still
            // decides — a post-close silence stays sacred.
            stall,
            // Measured stress on the rep's latest turn (build 3), or omitted.
            stress,
            // Option 3 — the rep's overall confidence read as a HINT (not a
            // gate): steady → lean silent; wavering/unsteady → lean supportive.
            confidence: confidenceRef.current?.hasEnough
              ? confidenceRef.current.level
              : undefined,
            // Attributed turns — the brain reads WHO said what.
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
        const c = data?.cue ?? {};
        // Capture the coach's read of the moment (§3.6 make it visible),
        // even when it stays silent, and remember the phase so the stall
        // timer never breaks a sacred post-close silence.
        if (typeof c.phase === "string") {
          lastPhaseRef.current = c.phase;
          setPhase(c.phase);
        }
        // eslint-disable-next-line no-console
        console.info(
          `[live-coaching] cue phase=${c.phase ?? "?"} trigger=${c.trigger ?? "?"} shouldCue=${!!c.shouldCue}`
        );
        if (c.shouldCue && c.cue) {
          lastCueAtRef.current = Date.now(); // start the cooldown
          // Track the persisted cue id so the rep can mark it "used" (0080).
          currentCueIdRef.current = (data?.cueId as string | null) ?? null;
          setCueMarked(false);
          setCurrentCue(c.cue);
          void speakCue(c.cue);
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

  // Rep confirms they USED the current cue → records a rep_marked outcome
  // (0080). First-party truth the After Pitch Summary prefers over inference.
  // Best-effort: a failure just leaves the post-call inference to fill in.
  const markCueUsed = useCallback(async () => {
    const cueId = currentCueIdRef.current;
    if (!cueId) return;
    setCueMarked(true); // optimistic — the confirmation is the visible result
    try {
      await fetch(`/api/coach/sales-session/${sessionId}/cue-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cueId, determination: "followed" }),
      });
    } catch {
      /* best-effort; inference still closes the loop post-call */
    }
  }, [sessionId]);

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
        // Reconcile the cue clock against what the commit scheduler did (pure
        // logic in cueCoordination.ts, regression-pinned there):
        //  - "keep"     — the instant content-guess already started this turn's
        //                 clock (L2); leave it — resetting re-adds the latency.
        //  - "schedule" — the LLM is the FIRST to determine prospect; start it.
        //  - "cancel"   — the guess said prospect but the LLM disagrees.
        // HONEST LIMIT (§3.4): "cancel" is BEST-EFFORT. It only wins the race
        // when /attribute returns UNDER TURN_SETTLE_MS (700ms); an LLM call
        // usually takes longer, so the timer has already fired and clearTimeout
        // is a no-op on an expired timer — the early cue already went out on the
        // (rare) wrong content tell. That residual risk is the ACCEPTED
        // latency↔accuracy tradeoff of L2 (founder: "very little or no delay"):
        // it's gated on a HIGH-PRECISION content tell (exactly-one-side match),
        // it self-corrects (the label settles here; later cues are right), and
        // invokeCue's own §3.3 gate often stays silent anyway. Do NOT trust
        // "cancel" as a hard interlock — reducing the risk further means waiting
        // on the LLM, which re-adds the latency L2 removes.
        const cueAction = reconcileCueAfterClassify({
          scheduledAtCommit: cueScheduledAtCommitRef.current === index,
          finalSpeaker,
          isLatestTurn: index === turnsRef.current.length - 1,
          autoCoach: autoCoachRef.current,
        });
        if (cueAction === "schedule") {
          if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
          cueTimerRef.current = setTimeout(() => void invokeCue(), TURN_SETTLE_MS);
        } else if (cueAction === "cancel") {
          if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
          cueScheduledAtCommitRef.current = -1;
        }
      } catch {
        settleLabel(null); // keep provisional, clear the pending flag
      }
    },
    [invokeCue]
  );

  const stop = useCallback(() => {
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    // #1 fix: persist the live attributed transcript (speaker-separated)
    // before teardown. This is the canonical transcript for in-person —
    // append-only, best-effort. A failure just leaves the recording-upload
    // fallback available.
    const captured = turnsRef.current;
    if (captured.length > 0) {
      // ONE server-side finalize (M3 structural fix, founder 2026-06-30).
      // The SERVER appends the transcript THEN generates + stores the Dissect
      // and Summary — so the admin reliably gets the dissect even if the
      // browser closes right after Stop. keepalive lets the request reach the
      // server during page unload; once received, the server runs to
      // completion independent of the client. Replaces the old client-side
      // segments→dissect→summary fire-and-forget (which dropped on tab-close).
      void fetch(`/api/coach/sales-session/${sessionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: captured.map((t, i) => ({
            speaker: t.speaker,
            text: t.text,
            seq: i,
          })),
        }),
        keepalive: true,
      })
        .then((r) => {
          if (r.ok) setTranscriptSaved(true);
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
    // "I'm speaking" is a live, moment-to-moment state — reset it on stop so it
    // never carries stale-ON into the next session and mislabels its first
    // turns (proactive audit, §1.5.2).
    agentSpeakingRef.current = false;
    setAgentSpeaking(false);
  }, [sessionId]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setTurns([]);
    turnsRef.current = [];
    setTranscriptSaved(false);
    utterEnergyRef.current = { sum: 0, count: 0 };
    pitchSepRef.current.reset();
    pitchAgreeRef.current = 0;
    agentLevelRef.current = null;
    customerLevelRef.current = null;
    micLevelRef.current = 0;
    setMicLevel(0);
    lastPhaseRef.current = null;
    setPhase(null);
    utteranceStartRef.current = null;
    paceBaselineRef.current = { mean: 0, count: 0 };
    lastStressCueAtRef.current = 0;
    recentStressRef.current = [];
    setConfidence(null);
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
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
          // Acoustic pitch on the same voiced frames — no extra latency. The
          // manual "I'm speaking" toggle anchors the agent's pitch cluster.
          pitchSepRef.current.pushFrame(
            detectF0(input, ctx.sampleRate),
            agentSpeakingRef.current
          );
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
          // Build 3 — mark when this utterance began (first partial after the
          // last commit) so a commit can measure its speaking duration.
          if (utteranceStartRef.current === null && (msg.text ?? "").trim()) {
            utteranceStartRef.current = Date.now();
          }
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
          // Close out the utterance's pitch too — clears the buffer every commit
          // (matching the energy reset) so frames don't bleed across turns. When
          // the rep holds "I'm speaking" this turn is ground-truth agent, so the
          // agent cluster is updated directly, never the nearest (audit F5).
          const pitch = pitchSepRef.current.labelTurn(
            agentSpeakingRef.current ? "agent" : undefined
          );
          if (!text) return;
          const locked = agentSpeakingRef.current;
          // Accuracy measurement (§4/§3.6): when the rep has confirmed "I'm
          // speaking" (ground truth = agent), compare what the AUTO verdict
          // WOULD have guessed — so separation accuracy is a watchable number,
          // not a hunch. Pure read; volumeVerdict doesn't mutate.
          if (locked) {
            const autoGuess = volumeVerdict(
              energy,
              agentLevelRef.current,
              customerLevelRef.current
            ).speaker;
            sepTotalRef.current += 1;
            if (autoGuess === "agent") sepAgreeRef.current += 1;
            if (pitch.speaker === "agent") pitchAgreeRef.current += 1;
            // eslint-disable-next-line no-console
            console.info(
              `[live-coaching] speaker-sep accuracy vol=${sepAgreeRef.current}/${sepTotalRef.current} pitch=${pitchAgreeRef.current}/${sepTotalRef.current} (vol=${autoGuess} pitch=${pitch.speaker}@${pitch.confidence.toFixed(2)} vs truth=agent)`
            );
          }
          // Proximity verdict (instant, content-independent) — the provisional
          // label AND the prior fed to the content classifier. When locked, the
          // toggle is passed as ground truth so it LABELS this turn agent AND
          // anchors the rep's level (§1 close-the-loop). Re-attribution below
          // is skipped when locked — the rep's explicit signal beats the guess.
          const v = volumeVerdict(
            energy,
            agentLevelRef.current,
            customerLevelRef.current,
            locked ? "agent" : null
          );
          agentLevelRef.current = v.agentLevel;
          customerLevelRef.current = v.customerLevel;
          // Compose the provisional label (§A16) LIVE and zero-latency, using
          // BOTH content and voice: the manual toggle wins when locked; else an
          // OBVIOUS content tell (guessSpeakerFromContent — instant, no network) wins,
          // because content is the reliable in-person signal; else a confident
          // pitch cluster (once anchored, audit F2); else loudness. The LLM
          // /attribute below refines the non-obvious cases — it gets the VOICE
          // hint and reasons on content itself, so both signals inform it too.
          const pitchTrusted =
            pitchSepRef.current.isAnchored() && pitch.confidence >= PITCH_TRUST;
          // Voice-only signal — passed to the LLM /attribute as its tiebreaker.
          const voiceHint: TranscriptSpeaker =
            pitchTrusted && pitch.speaker ? pitch.speaker : v.speaker;
          const contentGuess = guessSpeakerFromContent(text);
          const composed = composeProvisional({
            locked,
            content: contentGuess,
            pitch: pitch.speaker,
            pitchTrusted,
            loudness: v.speaker,
          });
          // Video A/B (founder 2026-07-06 → mic-only v1): a video call's mic is
          // AGENT-ONLY — the prospect is on the far end of the call, not in the
          // mic. So attribute every live turn to the rep; NEVER fabricate a
          // prospect turn from a content tell or loudness (§3.4 — the audit's
          // Layer-A flag). Prospect-side cues (objection/buying-signal) can't
          // fire mic-only; the rep-delivery cues (stress, on-demand, stall) do —
          // matching the "the coach hears your side" disclosure on the surface.
          const isVideo = contextRef.current === "video";
          const provisional: TranscriptSpeaker = isVideo ? "agent" : composed.speaker;
          const attrSource = isVideo ? "video-mic" : composed.source;
          const priorSpeaker =
            turnsRef.current[turnsRef.current.length - 1]?.speaker ?? "agent";
          const index = turnsRef.current.length;
          turnsRef.current = [
            ...turnsRef.current,
            // Video: pending:false — the label is final (agent), no /attribute
            // refine is coming. In-person: pending until the LLM settles it.
            { text, speaker: provisional, pending: !locked && !isVideo },
          ];
          setTurns(turnsRef.current);
          // eslint-disable-next-line no-console
          console.info(
            `[live-coaching] turn #${index + 1} committed (energy=${energy.toFixed(4)} vol=${v.speaker} pitch=${pitch.speaker}@${pitch.confidence.toFixed(2)} content=${contentGuess ?? "-"} → ${provisional} [src=${attrSource}]): "${text.slice(0, 80)}"`
          );
          // A new commit cancels any pending cue (the salesperson didn't
          // wait for it).
          if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
          cueScheduledAtCommitRef.current = -1;
          // L2 RESPONSE TIME: when the content is an OBVIOUS prospect turn, start
          // the cue clock NOW — don't wait for the /attribute round-trip. We
          // already know the prospect just spoke; the LLM only confirms it. This
          // removes the classifier latency from the cue on the common case.
          if (
            !isVideo &&
            shouldScheduleCueAtCommit({
              locked,
              contentGuess,
              autoCoach: autoCoachRef.current,
            })
          ) {
            cueScheduledAtCommitRef.current = index;
            cueTimerRef.current = setTimeout(() => void invokeCue(), TURN_SETTLE_MS);
          }
          // The LLM /attribute refines the label + gates the cue for the
          // non-obvious turns — IN-PERSON ONLY. Video is mic-only agent: there
          // is no prospect to distinguish, so we skip the round-trip entirely.
          if (!locked && !isVideo) void classifyTurn(index, text, priorSpeaker, voiceHint);

          // Build 3 — MEASURED stress on the rep's OWN turns. Close out this
          // utterance's speaking duration (first partial → this commit) and,
          // for an agent turn, measure filler density + pace vs the rep's own
          // baseline. A spike fires a SHORT steadying cue — still cooldown-
          // gated + brain-decided (§3.3), never spam. (§3.4 — pace is an
          // approximation from wall-clock duration, not word timestamps.)
          const uttStart = utteranceStartRef.current;
          utteranceStartRef.current = null;
          // Rep-delivery stress (filler/pace). In video every captured turn IS
          // the rep (mic-only), so measure all of them; in-person, only turns
          // the loudness read attributes to the rep.
          if (isVideo || v.speaker === "agent") {
            const fillerSpike = isFillerSpike(text);
            let paceSpike = false;
            if (uttStart !== null) {
              const durationSec = (Date.now() - uttStart) / 1000;
              const wpm = turnWpm(text, durationSec);
              if (wpm !== null) {
                // Judge against the PRIOR baseline, then fold this turn in.
                paceSpike = isPaceSpike(wpm, paceBaselineRef.current);
                paceBaselineRef.current = updatePaceBaseline(
                  paceBaselineRef.current,
                  wpm
                );
              }
            }
            if (
              (fillerSpike || paceSpike) &&
              autoCoachRef.current &&
              Date.now() - lastStressCueAtRef.current >= STRESS_COOLDOWN_MS
            ) {
              // Throttle on ATTEMPT (F2) — one nudge per episode, bounds LLM
              // cost even when the brain then chooses to stay silent.
              lastStressCueAtRef.current = Date.now();
              void invokeCue(false, false, { fillerSpike, paceSpike });
            }
            // Build 4 — record this rep turn's flags in the rolling window.
            recentStressRef.current = [
              ...recentStressRef.current,
              { filler: fillerSpike, pace: paceSpike },
            ].slice(-6);
          }

          // Build 4 — refresh the confidence read on EVERY turn (talk-ratio
          // shifts on customer turns too). Coarse + signal-based (§3.6/§4).
          {
            const recent = turnsRef.current.slice(-10);
            let repW = 0;
            let custW = 0;
            for (const t of recent) {
              const w = t.text.trim() ? t.text.trim().split(/\s+/).length : 0;
              if (t.speaker === "agent") repW += w;
              else if (t.speaker === "customer") custW += w;
            }
            const conf = computeConfidence({
              recentStress: recentStressRef.current,
              repWords: repW,
              customerWords: custW,
              // Video is mic-only: the prospect isn't in the mic, so talk-share
              // is unmeasurable (custW is always 0) — don't let it read as a
              // false "over-talking" (§1.5 ripple of the video attribution gate).
              customerAudible: !isVideo,
            });
            confidenceRef.current = conf;
            setConfidence(conf);
          }
          // Speech happened → reset the stall timer. After STALL_MS of
          // silence, consult the brain with the stall flag — it reads the
          // last AGENT turn and is the AUTHORITATIVE guard on the sacred
          // post-close silence (audit F1, 2026-07-01).
          //
          // The lastPhaseRef check below is ONLY a cheap best-effort
          // pre-filter, NOT the protection: lastPhaseRef is written solely
          // on customer turn-ends (invokeCue), so after an agent close the
          // customer hasn't answered yet it is stale (not "close") and this
          // check passes — the brain is what actually holds the silence.
          // We deliberately do NOT also suppress on "agent spoke last":
          // that would kill the legitimate lull-nudge (a stall with no
          // pending ask), which is the tester's SPEAK case. Only content —
          // the brain — can tell a close from a coachable lull.
          if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
          stallTimerRef.current = setTimeout(() => {
            if (autoCoachRef.current && lastPhaseRef.current !== "close") {
              void invokeCue(false, true);
            }
          }, STALL_MS);
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

  // Toggle the manual "agent is speaking" lock (single earbud tap / button).
  const toggleAgentSpeaking = useCallback(() => {
    const next = !agentSpeakingRef.current;
    agentSpeakingRef.current = next;
    setAgentSpeaking(next);
    // Audible confirmation to the earphones — distinct rising (ON) / falling
    // (OFF) tone so the rep knows the state without seeing the screen.
    playToggleBeep(next);
  }, []);

  return {
    agentSpeaking,
    toggleAgentSpeaking,
    recordingBlob,
    clearRecording,
    transcriptSaved,
    micLevel,
    status,
    turns,
    partial,
    currentCue,
    cueMarked,
    markCueUsed,
    cueStatus,
    phase,
    confidence,
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
