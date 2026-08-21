"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CueMode, TranscriptSpeaker, SalesContext } from "@/lib/data/salesCoach";
import {
  isFillerSpike,
  turnWpm,
  updatePaceBaseline,
  isPaceSpike,
  type PaceBaseline,
} from "@/lib/coach/v5/liveStress";
import { selectUnflushedSegments } from "@/lib/coach/v5/segmentFlush";
import {
  detectF0,
  PitchSeparator,
  shouldNudgeAnchor,
} from "@/lib/coach/v5/pitchSeparation";
import {
  guessSpeakerFromContent,
  composeProvisional,
} from "@/lib/coach/v5/speakerAttribution";
import {
  shouldScheduleCueAtCommit,
  reconcileCueAfterClassify,
} from "@/lib/coach/v5/cueCoordination";
import { decideCueDelivery } from "@/lib/coach/v5/cueDelivery";
import {
  formatCueMetric,
  summarizeCues,
  type CueTrace,
  type CueImportance,
} from "@/lib/coach/v5/cueInstrument";
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
// How many times to auto-reconnect the realtime socket after a mid-call drop before giving up (2026-08-21).
const MAX_RECONNECTS = 3;
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
// Below this per-turn separation confidence the voice split is "struggling".
// If several recent in-person turns are this low AND the rep hasn't grounded
// the split with the manual anchor, we nudge them to tap "I'm speaking".
const PITCH_HINT_LOW_CONF = 0.5;
const PITCH_HINT_MIN_TURNS = 3; // don't nag before the clusters have a chance
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
  // A2/§3.6: the fluidity readout for the just-ended call (median/p90 latency +
  // delivered/held), shown in the UI on Stop so it's readable without DevTools.
  const [cueSummary, setCueSummary] = useState<string | null>(null);
  // Auto-coach toggle (founder request 2026-06-27): when ON, the coach
  // cues automatically at pauses — no pressing "coach me now". When OFF,
  // it stays quiet (transcript still runs).
  // Default OFF (founder revision 2026-07-28, Sales Coach revision PDF: "Coach
  // automatic guidance off by default") — GLOBAL, both modes. The rep opts INTO
  // automatic cueing rather than opting out. autoCoachRef below mirrors this.
  const [autoCoach, setAutoCoachState] = useState(false);
  // Manual speaker override (founder 2026-07-03): a TOGGLE the rep drives with
  // a single earbud tap. When ON, every committed utterance is locked to
  // "agent" — a hard override of the loudness/content guess — for clean script
  // separation on the rep's turns. OFF = the automatic attribution runs.
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  // Pitch-anchor nudge (founder 2026-07-06): true when the in-person voice
  // separation is struggling and the rep hasn't anchored it yet — the panel
  // surfaces a hint to tap "I'm speaking". Ref mirrors state so the commit
  // handler can compare without a re-render churn; both reset on start/stop.
  const [anchorHint, setAnchorHint] = useState(false);
  const anchorHintRef = useRef(false);
  const recentPitchConfRef = useRef<number[]>([]);
  // F2: the recorded call audio, available after Stop, to feed the S1a
  // upload→diarize→label→review pipeline so a live session leaves a
  // persisted, reviewable record (§1.1). In-person only — the mic holds
  // both voices in a room; online video, it's agent-only.
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  // Whether the MediaRecorder is actively capturing call audio RIGHT NOW. This is the honest
  // signal the "not recording" banner needs: when the STT feed drops mid-call (status "error")
  // the recorder keeps running, so the audio is still being captured and is recoverable — the
  // banner must NOT tell the rep "nothing is being captured" in that case (§3.4, audit 2026-08-16).
  const [audioCapturing, setAudioCapturing] = useState(false);
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
  // Spec 4.3a — the 3-day silent-observe window. When the cue route reports it,
  // the coach is LISTENING, not broken; the panel says so (§3.6 make-it-visible),
  // so a first-days rep never reads the intentional silence as a bug.
  const [observing, setObserving] = useState(false);
  const [observeUntil, setObserveUntil] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  // Set true when the hook unmounts. start() awaits the mic prompt + token + ctx.resume BEFORE
  // its resources land in the refs above; if the component unmounts during one of those awaits,
  // the unmount cleanup frees nothing (refs still null) and start() would then build the mic
  // stream / recorder / AudioContext / socket on a dead component — leaving the mic indicator lit
  // forever. start() checks this after each await and tears down instead. Reset false on (re)mount
  // so a remount (incl. React strict-mode double-invoke) isn't wedged closed.
  const unmountedRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  // Session epoch — bumped on every start() and stop() (audit 2026-07-09 A6). An
  // in-flight /cue or /attribute captures the epoch at request time; if it resolves
  // after a stop→restart, the epoch no longer matches and the stale result is dropped
  // instead of writing a cue / speaker label into the NEW session. Additive-safe: it
  // can only DISCARD a superseded result, never suppress a valid one.
  const sessionEpochRef = useRef(0);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Idempotency guard (bug fix, 2026-07-06): finalize appends the transcript, and
  // coaching_transcript_segments has NO unique(session_id, seq) constraint — so a
  // double Stop / double finalize would DUPLICATE the whole transcript and the
  // post-call dissect would read doubled turns (§3.1). Fire finalize once/session.
  const finalizedRef = useRef(false);
  // Incremental transcript persistence (2026-08-21 capture-loss fix). The live transcript used to live ONLY in
  // turnsRef and was written in one batch on Stop→/finalize — so any un-clean end (tab close, nav-away, WS drop,
  // rep never Stopping) lost the whole conversation (52% of sessions stored zero segments). Now a timer flushes
  // SETTLED turns to /segments every few seconds, and a pagehide beacon catches the rest, so a dropped session
  // keeps what was captured. flushedSegsRef tracks which seqs are already persisted (idempotent with finalize's
  // re-send — the table has unique(session_id, seq)).
  const flushedSegsRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Auto-reconnect on a mid-call WebSocket drop (2026-08-21 "session keeps dropping" fix). The ElevenLabs
  // realtime socket can close mid-session (network blip, single-use-token expiry on a long call, provider close);
  // before, the handler just went silently to "idle" and capture DIED with no recovery. Now a recoverable drop
  // re-runs start() (fresh token + socket + audio graph) while PRESERVING the transcript (reconnectingRef gates
  // the reset), bounded by MAX_RECONNECTS with backoff, and never after an intentional stop (stoppedRef).
  const reconnectAttemptsRef = useRef(0);
  const stoppedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const startRef = useRef<() => void>(() => {});
  // The turn index whose cue clock was started AT COMMIT by an obvious content
  // tell (before the LLM /attribute returned) — so classifyTurn doesn't reset
  // the timer and re-add the latency we just saved (L2 response time). -1 = none.
  const cueScheduledAtCommitRef = useRef(-1);
  const cueInFlightRef = useRef(false);
  const modeRef = useRef<CueMode>("suggestion");
  const lastCueAtRef = useRef(0); // F4 cooldown (ms epoch); 0 = never
  const currentCueIdRef = useRef<string | null>(null); // DB id of the shown cue
  // A2 instrumentation: every cue's latency+relevance trace, for the live-test
  // readout (median/p90 end-to-end + delivered/suppressed). Summary logged on stop.
  const cueTracesRef = useRef<CueTrace[]>([]);
  const lastStressCueAtRef = useRef(0); // F2 — stress-cue cooldown (ms epoch)
  const autoCoachRef = useRef(false); // mirrors autoCoach (default OFF, 2026-07-28) for ws closures
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
      stress?: { fillerSpike: boolean; paceSpike: boolean },
      // Fix A (audit 2026-07-06): the delay the agent actually feels starts when
      // the prospect STOPPED talking (the turn commit) — NOT when this callback
      // runs, which for the auto-cue path is ~700ms later (after the settle). The
      // auto-cue caller passes the commit time; on-demand/stall default to now.
      triggeredAtArg?: number
    ) => {
      const triggeredAt = triggeredAtArg ?? performance.now();
      // A6: the session this cue belongs to. If it changes before we deliver (the
      // rep hit Stop/Start during the round-trip), we drop the cue instead of
      // speaking a stale-session cue into the new one.
      const cueEpoch = sessionEpochRef.current;
      // Fix B (audit 2026-07-06): record a trace on EVERY exit branch, not just
      // the success path — else the readout undercounts failures + cooldown
      // suppressions (A14 completeness / A2 honest measurement).
      const recordTrace = (t: Partial<CueTrace> & { delivered: boolean }) => {
        const trace: CueTrace = {
          triggeredAt,
          mode: contextRef.current === "video" ? "video" : "in_person",
          ...t,
        };
        cueTracesRef.current.push(trace);
        // eslint-disable-next-line no-console
        console.info(formatCueMetric(trace));
      };
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
        recordTrace({ delivered: false, suppressReason: "cooldown" });
        return; // within cooldown — don't auto-cue over a fresh cue
      }
      cueInFlightRef.current = true;
      if (onDemand) setCueStatus("Thinking…");
      let llmStartedAt = triggeredAt;
      try {
        llmStartedAt = performance.now();
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
          recordTrace({
            llmStartedAt,
            llmEndedAt: performance.now(),
            delivered: false,
            suppressReason: `http-${res.status}`,
          });
          if (onDemand) setCueStatus(`Cue request failed (${res.status}).`);
          return;
        }
        const llmEndedAt = performance.now();
        const data = await res.json();
        // 3-day observe (spec 4.3a): the route silenced a PROACTIVE cue because
        // this rep is still in their listening window. Surface it, don't hide it.
        if (data?.observing) {
          setObserving(true);
          if (typeof data.observeUntil === "string") setObserveUntil(data.observeUntil);
        }
        const c = data?.cue ?? {};
        // Capture the coach's read of the moment (§3.6 make it visible),
        // even when it stays silent, and remember the phase so the stall
        // timer never breaks a sacred post-close silence.
        if (typeof c.phase === "string") {
          lastPhaseRef.current = c.phase;
          setPhase(c.phase);
        }
        const importance: CueImportance =
          c.importance === "high" || c.importance === "low" ? c.importance : "medium";
        // Delivery gate (Piece 2 — the single best cue, §3.3): the engine already
        // applied the §3.2 understanding gate; this drops "low" cues so only what
        // matters reaches the ear. On-demand always delivers (the rep asked).
        const decision = decideCueDelivery({
          shouldCue: !!c.shouldCue,
          hasCue: typeof c.cue === "string" && c.cue.length > 0,
          importance,
          onDemand,
        });
        let deliveredAt: number | undefined;
        // A6: only deliver if we're still in the SAME session the cue was requested
        // for. If not, fall through (deliveredAt stays undefined → recorded as
        // not-delivered) rather than speaking a stale cue into the new session.
        if (decision.deliver && cueEpoch === sessionEpochRef.current) {
          lastCueAtRef.current = Date.now(); // start the cooldown
          // Track the persisted cue id so the rep can mark it "used" (0080).
          currentCueIdRef.current = (data?.cueId as string | null) ?? null;
          setCueMarked(false);
          setCurrentCue(c.cue);
          deliveredAt = performance.now(); // cue reaches the ear (TTS start)
          void speakCue(c.cue);
        } else if (onDemand) {
          // force was on, so this is rare — but don't leave the button dead.
          setCueStatus("Coach had nothing pressing to add right now.");
        }
        recordTrace({
          llmStartedAt,
          llmEndedAt,
          deliveredAt,
          importance,
          phase: typeof c.phase === "string" ? c.phase : undefined,
          trigger: typeof c.trigger === "string" ? c.trigger : undefined,
          delivered: decision.deliver,
          suppressReason: decision.suppressReason,
        });
      } catch (err) {
        recordTrace({
          llmStartedAt,
          delivered: false,
          suppressReason: "exception",
        });
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
      // A6: the session this attribution belongs to. If /attribute resolves after a
      // stop→restart, turnsRef has been reset/refilled by the new session, and writing
      // `speaker` at `index` would mislabel a FRESH-session turn. Drop it instead.
      const turnEpoch = sessionEpochRef.current;
      const settleLabel = (speaker: TranscriptSpeaker | null) => {
        if (turnEpoch !== sessionEpochRef.current) return;
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
          // Fix A: stamp the turn-end so the measured latency includes the settle.
          const turnEndedAt = performance.now();
          cueTimerRef.current = setTimeout(
            () => void invokeCue(false, false, undefined, turnEndedAt),
            TURN_SETTLE_MS
          );
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

  // Flush settled (or, on end/unload, all remaining) captured turns to the append-only /segments route so the
  // transcript survives an un-clean end. Best-effort: a failure leaves the seqs unflushed for the next tick /
  // the Stop finalize. `useBeacon` sends via sendBeacon (survives page unload) — used on pagehide/nav-away.
  const flushSegments = useCallback(
    (includePending: boolean, useBeacon = false) => {
      const segs = selectUnflushedSegments(turnsRef.current, flushedSegsRef.current, includePending).slice(0, 500);
      if (segs.length === 0) return;
      const seqs = segs.map((s) => s.seq);
      const payload = { segments: segs.map((s) => ({ speaker: s.speaker, text: s.text, seq: s.seq })) };
      const url = `/api/coach/sales-session/${sessionId}/segments`;
      const body = JSON.stringify(payload);
      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        // sendBeacon carries same-origin cookies (auth) and survives unload. Fire-and-forget → mark optimistically.
        const ok = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        if (ok) seqs.forEach((s) => flushedSegsRef.current.add(s));
        return;
      }
      void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body })
        .then((r) => { if (r.ok) seqs.forEach((s) => flushedSegsRef.current.add(s)); })
        .catch(() => { /* best-effort — the same seqs retry next tick / on finalize */ });
    },
    [sessionId]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true; // intentional stop → the ws.onclose below must NOT auto-reconnect
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
    // A6: invalidate any in-flight /cue or /attribute so a late resolution can't
    // write into a session that has ended (or the next one, after a restart).
    sessionEpochRef.current += 1;
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    // #1 fix: persist the live attributed transcript (speaker-separated)
    // before teardown. This is the canonical transcript for in-person —
    // append-only, best-effort. A failure just leaves the recording-upload
    // fallback available.
    const captured = turnsRef.current;
    if (captured.length > 0 && !finalizedRef.current) {
      // Guard: fire finalize at most ONCE per session (see finalizedRef) — a
      // second Stop would otherwise duplicate the transcript server-side.
      finalizedRef.current = true;
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
    // A2 readout: the "is it fluid?" summary for this call — median/p90 end-to-end
    // cue latency + delivered/suppressed counts (§3.5 consequence, §3.6 visible).
    if (cueTracesRef.current.length > 0) {
      const s = summarizeCues(cueTracesRef.current);
      const line =
        `${s.delivered} cue${s.delivered === 1 ? "" : "s"} delivered, ` +
        `${s.suppressed} held back · ` +
        `median ${s.medianTotalMs ?? "—"}ms, p90 ${s.p90TotalMs ?? "—"}ms end-to-end · ` +
        // The stage breakdown is the part that decides the timing work: it names
        // WHERE the delay lives (settle/queue vs the LLM round-trip vs TTS), so
        // the total isn't just a number the founder can't act on (§4/A2).
        `where: settle ${s.medianQueueMs ?? "—"}ms · llm ${s.medianLlmMs ?? "—"}ms · tts ${s.medianTtsMs ?? "—"}ms`;
      // §3.6 make it visible — surface the fluidity readout in the UI too, not
      // just the console, so the readout is readable without DevTools.
      setCueSummary(line);
      // eslint-disable-next-line no-console
      console.info(
        `[cue-summary] delivered=${s.delivered} suppressed=${s.suppressed} ` +
          `median=${s.medianTotalMs ?? "—"}ms p90=${s.p90TotalMs ?? "—"}ms ` +
          `settle=${s.medianQueueMs ?? "—"}ms llm=${s.medianLlmMs ?? "—"}ms tts=${s.medianTtsMs ?? "—"}ms`
      );
    }
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

  // Free every live-coaching media resource straight from the refs — NO setState, so it is safe
  // to call after the component has unmounted. Shared by the unmount cleanup AND start()'s
  // mid-await cancel path (stop() keeps its own inline teardown, which the audit verified sound).
  const teardownMedia = useCallback(() => {
    try {
      recorderRef.current?.stop();
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
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    // Fresh readout per call — clear the prior session's traces + summary.
    cueTracesRef.current = [];
    setCueSummary(null);
    finalizedRef.current = false; // allow this session's finalize to fire once
    setAudioCapturing(false); // reset: only becomes true once rec.start() succeeds below
    setStatus("connecting");
    // A6: new session epoch — any /cue or /attribute still in flight from a prior
    // session is now stale and will be dropped when it resolves.
    sessionEpochRef.current += 1;
    // Fresh start resets the transcript; an AUTO-RECONNECT (reconnectingRef) PRESERVES it so a mid-call drop
    // doesn't wipe what was captured — the same session continues appending from where it dropped.
    if (reconnectingRef.current) {
      reconnectingRef.current = false; // consume the reconnect flag
    } else {
      setTurns([]);
      turnsRef.current = [];
      flushedSegsRef.current = new Set();
      reconnectAttemptsRef.current = 0;
      stoppedRef.current = false;
    }
    setTranscriptSaved(false);
    // (Re)start incremental transcript persistence (2026-08-21 capture-loss fix): flush settled turns to the DB
    // every few seconds so a drop/close/never-Stop keeps the conversation.
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = setInterval(() => flushSegments(false), 4000);
    utterEnergyRef.current = { sum: 0, count: 0 };
    pitchSepRef.current.reset();
    pitchAgreeRef.current = 0;
    // Reset the separation-accuracy tally too (audit 2026-07-09): only pitchAgreeRef
    // was reset here, so sepTotal/sepAgree carried across a stop→start and the logged
    // "is separation better?" ratio was corrupted (stale denominator + out-of-sync
    // pitch count) after any restart.
    sepAgreeRef.current = 0;
    sepTotalRef.current = 0;
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
    recentPitchConfRef.current = [];
    anchorHintRef.current = false;
    setAnchorHint(false);
    // Clear the cue-overlap guard: a prior session's /cue fetch may still be pending (no timeout on
    // it), and its flag is otherwise cleared only in its own finally. Without this reset a stop→start
    // over an in-flight cue leaves cueInFlightRef stuck true, so EVERY cue in the new session —
    // including on-demand "Coach me now" — silently returns at the guard until the stale fetch settles.
    cueInFlightRef.current = false;
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    try {
      // 1. Mic.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Unmounted while the mic prompt was open? Free the stream and abort before building anything.
      if (unmountedRef.current) {
        teardownMedia();
        return;
      }

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
          // Capture has ended (stop/teardown) — the banner must no longer claim audio is recording.
          setAudioCapturing(false);
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
        // Audio is now being captured — true even if the STT feed later errors (the recorder
        // runs independently), which is exactly what keeps the "not recording" banner honest.
        setAudioCapturing(true);
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
      // Unmounted during the token round-trip? Free the stream + recorder and abort.
      if (unmountedRef.current) {
        teardownMedia();
        return;
      }

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
      // Unmounted while the AudioContext was resuming? Free stream + recorder + ctx and abort
      // before opening the socket / building the audio graph.
      if (unmountedRef.current) {
        teardownMedia();
        return;
      }
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

      // Track whether the socket ever opened. A close WITHOUT a prior open = the handshake itself failed,
      // and the browser's onerror event is intentionally opaque (no code/reason for security). The CLOSE
      // code is the only real signal, so surface it to the rep — otherwise "Realtime connection error" is a
      // black box on a phone with no console (2026-08-14: backend proven healthy from the server, so a
      // browser-only failure needs its close code to diagnose).
      let wsOpened = false;
      ws.onopen = () => {
        wsOpened = true;
        // A successful (re)connect refills the reconnect budget, so MAX_RECONNECTS bounds CONSECUTIVE failures
        // (a session that reconnects cleanly keeps working through occasional drops), not total drops per session.
        reconnectAttemptsRef.current = 0;
        // eslint-disable-next-line no-console
        console.info("[live-coaching] ws OPEN");
        setStatus("live");
      };
      ws.onerror = (ev) => {
        // eslint-disable-next-line no-console
        console.warn("[live-coaching] ws ERROR", ev);
        // Generic fallback only — the onclose below refines it with the actual close code. onerror carries
        // no usable detail in browsers, so we never rely on it for the cause.
        setError("Realtime connection error.");
        setStatus("error");
      };
      ws.onclose = (ev) => {
        // eslint-disable-next-line no-console
        console.warn(
          `[live-coaching] ws CLOSE code=${ev.code} reason=${ev.reason || "(none)"}`
        );
        if (!wsOpened) {
          // Never opened → handshake failed. Name the exact close code so the rep can report it and we can
          // pinpoint the cause (1006 = network/dropped/blocked, 1008/4401 = auth/policy, 1011 = server) instead
          // of guessing from an opaque "connection error." The recording is still saving locally, so always
          // point at the upload fallback (§3.4 — honest error + a way forward).
          const detail = ev.reason ? ` — ${ev.reason}` : "";
          setError(
            `Realtime connection couldn't start (code ${ev.code}${detail}). Your recording is still saving — you can upload it below to get your transcript.`
          );
          setStatus("error");
          return;
        }
        // Opened then closed = a mid-session drop. AUTO-RECONNECT (2026-08-21 "keeps dropping" fix): re-run
        // start() with the transcript preserved (reconnectingRef) — fresh token + socket + audio graph — so
        // capture RESUMES instead of dying silently. Bounded (MAX_RECONNECTS) with linear backoff; never after an
        // intentional stop or unmount. The incremental flush already persisted the turns up to the drop, so the
        // reconnect is about resuming capture, not saving data.
        if (!stoppedRef.current && !unmountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECTS) {
          reconnectAttemptsRef.current += 1;
          setStatus("connecting");
          setTimeout(() => {
            if (stoppedRef.current || unmountedRef.current) return;
            reconnectingRef.current = true;
            teardownMedia(); // free the dropped session's mic / socket / ctx first
            startRef.current(); // rebuild + resume (preserves turnsRef)
          }, 500 * reconnectAttemptsRef.current);
          return;
        }
        // Exhausted reconnects (or an intentional close): reflect the dead connection honestly. Functional form
        // reads the CURRENT status, not start's stale closure. Don't stomp an "error" already set.
        setStatus((prev) => (prev === "live" ? "idle" : prev));
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
          if (!text) {
            // An empty commit (noise burst) still ENDS the current utterance —
            // clear the per-utterance start so the NEXT turn measures pace from its
            // OWN first partial, not across this gap (audit 2026-07-09: a stale start
            // inflated durationSec → WPM too low → pace spikes silently missed).
            utteranceStartRef.current = null;
            return;
          }
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
          // Video A/B (founder 2026-07-06 → mic-only v1): a video call's mic is
          // AGENT-ONLY — the prospect is on the far end of the call, not in the
          // mic. composeProvisional applies that as a HARD override (isVideo →
          // rep, never fabricate a prospect turn from content/loudness; §3.4,
          // the audit's Layer-A flag). Prospect-side cues can't fire mic-only;
          // the rep-delivery cues (stress, on-demand, stall) do — matching the
          // "the coach hears your side" disclosure on the surface.
          const isVideo = contextRef.current === "video";
          const composed = composeProvisional({
            locked,
            content: contentGuess,
            pitch: pitch.speaker,
            pitchTrusted,
            loudness: v.speaker,
            isVideo,
          });
          const provisional: TranscriptSpeaker = composed.speaker;
          const attrSource = composed.source;
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
            // Fix A: stamp the turn-end NOW (the commit) so the cue's measured
            // end-to-end latency includes the settle wait, not just llm+tts.
            const turnEndedAt = performance.now();
            cueTimerRef.current = setTimeout(
              () => void invokeCue(false, false, undefined, turnEndedAt),
              TURN_SETTLE_MS
            );
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
          // attributed to the rep by the COMPOSED read (content > pitch > loudness).
          // Bug fix (audit 2026-07-09): this gated on `v.speaker` (loudness ONLY),
          // so when content/pitch overrode loudness — the exact case attribution
          // exists for — a steadying "you sound nervous" cue fired at the rep for
          // the CUSTOMER's fillers, and skewed the confidence read. Use `provisional`.
          if (isVideo || provisional === "agent") {
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

          // Pitch-anchor nudge (founder 2026-07-06): IN-PERSON only — video is
          // mic-only agent, there is no voice split to sharpen. When the last
          // few UNLOCKED turns keep separating with low confidence AND the rep
          // hasn't grounded the split with the manual anchor, surface a hint to
          // tap "I'm speaking". One tap anchors the agent cluster and sharpens
          // the whole split. §3.3 — we GUIDE (show the hint); the rep acts. It
          // self-clears once anchored (isAnchored) or confidence recovers.
          if (!isVideo) {
            if (!locked) {
              recentPitchConfRef.current = [
                ...recentPitchConfRef.current,
                pitch.confidence,
              ].slice(-PITCH_HINT_MIN_TURNS);
            }
            const hint = shouldNudgeAnchor({
              anchored: pitchSepRef.current.isAnchored(),
              recentConfidences: recentPitchConfRef.current,
              lowThreshold: PITCH_HINT_LOW_CONF,
              minTurns: PITCH_HINT_MIN_TURNS,
            });
            if (hint !== anchorHintRef.current) {
              anchorHintRef.current = hint;
              setAnchorHint(hint);
            }
          } else if (anchorHintRef.current) {
            anchorHintRef.current = false;
            setAnchorHint(false);
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
    // `status` intentionally omitted: the only read was the stale onclose check,
    // now replaced by the functional setStatus form. Keeping it here would
    // recreate `start` on every status transition for no benefit.
  }, [invokeCue, stop, classifyTurn, teardownMedia, flushSegments]);

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

  // Cleanup on UNMOUNT (bug fix, 2026-07-06 read-audit): the hook had no
  // useEffect at all, so navigating away mid-session without pressing Stop left
  // the MIC ON with no visible session (a privacy + resource leak), plus an open
  // socket + AudioContext + live timers. Free everything via refs (always
  // current) on unmount. Empty deps → runs once, on teardown.
  useEffect(() => {
    // (Re)mount: clear the cancel flag so a remount (incl. React strict-mode double-invoke)
    // isn't permanently wedged into the "unmounted" branch of start().
    unmountedRef.current = false;
    // Tab-close / hide / nav-away is where the old batch-on-Stop lost everything (no unload handler existed).
    // Beacon the remaining un-flushed turns (incl. still-pending) so the transcript survives — sendBeacon is
    // delivered by the browser even as the page unloads. visibilitychange→hidden covers mobile/background.
    const beaconFlush = () => flushSegments(true, true);
    const onVisibility = () => { if (typeof document !== "undefined" && document.visibilityState === "hidden") beaconFlush(); };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", beaconFlush);
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      // Signal any in-flight start() to abort after its current await, THEN free whatever is
      // already in the refs. Freeing from refs alone missed resources start() acquires AFTER an
      // await (the mic-prompt window) — the flag closes that gap.
      unmountedRef.current = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", beaconFlush);
        document.removeEventListener("visibilitychange", onVisibility);
      }
      beaconFlush(); // nav-away without Stop: beacon whatever's still un-flushed before teardown
      teardownMedia();
    };
  }, [teardownMedia, flushSegments]);

  // Keep startRef pointing at the latest start() so ws.onclose can trigger an auto-reconnect without a
  // circular useCallback dependency (start ⇄ onclose). Ref indirection resolves start at call time.
  useEffect(() => {
    startRef.current = () => void start();
  }, [start]);

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
    anchorHint,
    recordingBlob,
    clearRecording,
    transcriptSaved,
    micLevel,
    status,
    audioCapturing,
    turns,
    partial,
    currentCue,
    cueMarked,
    markCueUsed,
    cueStatus,
    cueSummary,
    phase,
    confidence,
    observing,
    observeUntil,
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
