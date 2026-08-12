"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Square, Sparkles, Hand, CheckCircle2, Mic, AlertTriangle } from "lucide-react";
import { useTapControls } from "@/lib/coach/v5/useTapControls";
import { useLiveCoaching } from "@/lib/coach/v5/useLiveCoaching";
import type { SalesContext } from "@/lib/data/salesCoach";
import { SessionRecordingUpload } from "./SessionRecordingUpload";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { LearningHint } from "@/components/learning/LearningHint";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import { persistRecording } from "@/lib/coach/v5/persistRecording";

/**
 * LiveCoachingPanel — Live Sales Coach S1b surface.
 *
 * Start/stop live coaching, pick the cue mode, see the rolling
 * transcript + the current cue, and tap "coach me" on demand. The cue
 * also auto-fires at conversation pauses (the brain decides whether to
 * speak). UNTESTED on real hardware.
 */
export function LiveCoachingPanel({
  sessionId,
  context,
  onRecordingSaved,
  // Whether this session is still ACTIVE (not ended). Gates the "you're not
  // recording yet" banner so it can't misfire on an already-ended session that
  // still shows this panel (Expert stays on the page after ending). Defaults
  // true so a caller that doesn't pass it keeps the safety prompt.
  active = true,
}: {
  sessionId: string;
  context?: SalesContext;
  onRecordingSaved?: () => void;
  active?: boolean;
}) {
  const {
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
    cueSummary,
    phase,
    confidence,
    observing,
    observeUntil,
    autoCoach,
    setAutoCoach,
    agentSpeaking,
    toggleAgentSpeaking,
    anchorHint,
    mode,
    setMode,
    error,
    start,
    stop,
    requestCue,
  } = useLiveCoaching(sessionId, context);

  // Experience dial. Standard collapses the two-mode toggle to one (spec p4.3:
  // "leave just 1 button") — door-to-door reps want a single light-touch nudge,
  // not a mode decision mid-call. Expert keeps both modes, unchanged.
  const { isStandard } = useExperienceMode();

  // F1: the cue plays to the agent's default output — the code can't
  // guarantee the customer won't hear it. So gate Start on the agent
  // confirming they're on an in-ear earpiece (honest enforcement of an
  // instruction, not a false guarantee).
  const [earpieceOk, setEarpieceOk] = useState(false);

  const live = status === "live";

  // ── "Never lose the audio" (founder priority 2026-08-12, first-client incident) ────────────────────────────
  // The instant recording stops, PERSIST the recorded audio to Storage — BEFORE anything navigates away — so a
  // call whose live STT captured nothing is always recoverable (previously the blob lived only in browser memory
  // and was lost on the After-Pitch redirect → "No conversation was captured", unrecoverable). Runs once per
  // recording. Best-effort + timeout-bounded: if the save fails or hangs, we still let the rep proceed (the
  // manual upload UI + re-transcribe remain), never trapping them on "Saving…". `savingState`:
  //   'pending'  — recording not yet stopped / no blob
  //   'saving'   — uploading the audio to storage (the "block with Saving recording…" state the founder chose)
  //   'saved'    — audio safely in storage (audio_asset_url stamped)
  //   'failed'   — save didn't complete; audio may be lost, but don't trap the rep
  const [savingState, setSavingState] = useState<"pending" | "saving" | "saved" | "failed">("pending");
  const persistStartedRef = useRef(false);
  const persistSettledRef = useRef(false);
  useEffect(() => {
    if (!recordingBlob || live || persistStartedRef.current) return;
    persistStartedRef.current = true;
    setSavingState("saving");
    let done = false;
    const settle = (s: "saved" | "failed") => {
      if (done) return;
      done = true;
      persistSettledRef.current = true;
      setSavingState(s);
    };
    // 60s ceiling so a stalled upload on a flaky mobile connection can't trap the rep forever.
    const timer = setTimeout(() => settle("failed"), 60_000);
    void (async () => {
      try {
        await persistRecording(sessionId, recordingBlob);
        clearTimeout(timer);
        settle("saved");
      } catch (e) {
        clearTimeout(timer);
        // eslint-disable-next-line no-console
        console.error("[live-coaching] audio persist failed", e);
        settle("failed");
      }
    })();
  }, [recordingBlob, live, sessionId]);

  // Advance to naming / After-Pitch once the transcript saved AND the audio persist has SETTLED — so the
  // recording is safely in Storage before we navigate (founder chose "block with Saving recording…"). Fire
  // EXACTLY ONCE (onRecordingSaved is often an inline callback with a new identity each render). If there is no
  // blob to persist (recorder unavailable), persistStartedRef stays false and we don't wait on it.
  const savedFiredRef = useRef(false);
  useEffect(() => {
    if (!transcriptSaved || savedFiredRef.current) return;
    if (persistStartedRef.current && !persistSettledRef.current) return; // still saving the audio — wait
    savedFiredRef.current = true;
    onRecordingSaved?.();
  }, [transcriptSaved, savingState, onRecordingSaved]);

  // Build 5 — earpiece tap control (§3.3, rep-controlled). A tap → coach me;
  // triple-tap → quiet toggle. Device-dependent + unverifiable (§3.4).
  const toggleQuiet = useCallback(
    () => setAutoCoach(!autoCoach),
    [setAutoCoach, autoCoach]
  );
  const { supported: tapsSupported, lastTapAt } = useTapControls({
    active: live,
    onAgentSpeaking: toggleAgentSpeaking,
    onCoachMe: requestCue,
    onToggleQuiet: toggleQuiet,
  });
  // Flash a confirmation when a tap actually reaches the app — the quickest
  // way to VERIFY the earbud→browser path works, apart from the cue firing.
  const [tapFlash, setTapFlash] = useState(false);
  useEffect(() => {
    if (!lastTapAt) return;
    setTapFlash(true);
    const t = setTimeout(() => setTapFlash(false), 2500);
    return () => clearTimeout(t);
  }, [lastTapAt]);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio
            className={`w-4 h-4 ${live ? "text-ember-400 animate-pulse" : "text-muted"}`}
            aria-hidden
          />
          <h2 className="text-sm font-semibold text-primary">
            Live coaching
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-muted font-mono">
            {status}
          </span>
          {/* §3.6: show the coach's LAST read of the phase, so its restraint
              is legible (it's watching + choosing silence, not asleep).
              F3 (audit 2026-07-01): this refreshes only when the brain is
              consulted (on turns), so during a silence it's the last read,
              not a live assertion — the label + title say so honestly. */}
          {live && phase && (
            <span
              className="text-[10px] uppercase tracking-widest text-brand/80 font-mono"
              title="The coach's last read of the moment — updates as the conversation moves, not continuously."
            >
              · {phase.replace("_", " ")} <span className="text-muted">(last read)</span>
            </span>
          )}
          {/* Build 4 — the SIGNAL-BASED confidence read (§3.6). F1 (tone-law):
              the rep-facing label is SUPPORTIVE/actionable, never a bare "you
              are unsteady" verdict shown back at them mid-call. F2 (§4): the
              "signal" marker is VISIBLE (not hover-only), so the unvalidated
              status shows without a hover / on touch. */}
          {live && confidence?.hasEnough && (
            <span
              className={`text-[10px] uppercase tracking-widest font-mono ${
                confidence.level === "steady"
                  ? "text-emerald-300/80"
                  : confidence.level === "wavering"
                    ? "text-amber-300/80"
                    : "text-amber-400/80"
              }`}
              title={`Signal-based read (NOT yet validated against outcomes). Fillers: ${
                confidence.fillerHigh ? "high" : "ok"
              } · Pace: ${confidence.rushing ? "rushing" : "steady"}${
                confidence.talkShareKnown
                  ? ` · You're speaking ${Math.round(
                      confidence.repTalkShare * 100
                    )}% of recent words.`
                  : "" // video mic-only: talk-share isn't measurable (prospect not in the mic)
              }`}
            >
              ·{" "}
              {confidence.level === "steady"
                ? "steady"
                : confidence.level === "wavering"
                  ? "find your rhythm"
                  : "slow + steady"}{" "}
              <span className="text-muted normal-case">· signal</span>
            </span>
          )}
        </div>
        <LearningHint
          as="inline-block"
          category="Sales Coach · Live coaching"
          title="Start / stop live coaching"
          whatItIs="Begins (or ends) the live listening session — the coach starts hearing the conversation and can cue you in real time."
          why="Real-time coaching only works while it's actually listening. Starting is the moment the loop goes live; stopping is what saves the speaker-separated transcript for your review."
          how="Start once your earpiece is in and you're ready. Stop when the conversation ends — that's what writes the transcript and unlocks the growth review."
          principle="The coach can only help the conversation it's actually in."
        >
        <div className="flex items-center gap-2">
          {!live ? (
            <LoadingButton
              pending={status === "connecting"}
              onClick={() => void start()}
              disabled={!earpieceOk}
              icon={<Radio className="w-3.5 h-3.5" aria-hidden />}
              pendingLabel="Connecting…"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
            >
              Start live coaching
            </LoadingButton>
          ) : (
            <button
              type="button"
              onClick={() => stop()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary border border-default px-3 py-2 rounded-lg"
            >
              <Square className="w-3.5 h-3.5" aria-hidden />
              Stop
            </button>
          )}
        </div>
        </LearningHint>
      </div>

      {/* Unmissable "not recording" state (founder 2026-07-26, images 1+3 bug).
          Root cause of the empty After-Pitch summary: a rep taps "Start session",
          believes recording has begun, delivers the whole pitch, and captures 0
          segments — because recording only starts on THIS button. When the session
          is not live (idle or error), say so LOUDLY and name the exact trap, so the
          rep can't pitch without recording (AMD-006 L3; §3.4 — an error is shown,
          not swallowed). Hidden while connecting (transient) and once live. */}
      {active && !live && status !== "connecting" && (
        <div className="mt-3 rounded-xl border border-amber-500/45 bg-amber-500/[0.08] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">
                {status === "error"
                  ? "Recording stopped — nothing is being captured."
                  : "You're not recording yet."}
              </p>
              <p className="text-[11px] text-secondary leading-relaxed mt-0.5">
                {status === "error" && error
                  ? error
                  : "Tap Start live coaching before you begin."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mode toggle. Standard shows one mode only (spec p4.3), so the "Mode:"
          label is dropped too — a label for a single fixed choice is noise. */}
      <div className="flex items-center gap-2 mt-3">
        {!isStandard && <span className="text-[11px] text-muted">Mode:</span>}
        <LearningHint
          as="inline-block"
          category="Sales Coach · Live coaching"
          title="Suggestion mode"
          whatItIs="Sets the coach to offer a short nudge — a direction to take — rather than words to say."
          why="A nudge keeps you in your own voice. You stay the one talking; the coach just points. That's what builds your instinct instead of a dependence on being fed lines."
          how="Pick this when you want a light touch — a reminder of what to reach for at the right moment."
          principle="A pointer grows the skill; a script rents it."
        >
        <button
          type="button"
          onClick={() => setMode("suggestion")}
          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
            mode === "suggestion"
              ? "border-ember-400/50 bg-ember-400/10 text-brand"
              : "border-default text-secondary hover:text-primary"
          }`}
        >
          Suggestion
        </button>
        </LearningHint>
        {/* "Guide my response" — Expert only (spec p4.3 collapses the modes to one
            for Standard). Expert keeps the heavier-touch second mode, unchanged. */}
        {!isStandard && (
        <LearningHint
          as="inline-block"
          category="Sales Coach · Live coaching"
          title="Guide my response"
          whatItIs="Sets the coach to hand you a more concrete way to phrase your next response."
          why="When you're stuck mid-conversation, a concrete phrasing gets you unstuck faster than an abstract nudge. It's the heavier-touch mode for the moments that need it."
          how="Switch to this on hard objections or when your mind blanks. Lean on Suggestion mode the rest of the time so the skill stays yours."
          principle="Use the heavier hand only where the lighter one isn't enough."
        >
        <button
          type="button"
          onClick={() => setMode("guide_response")}
          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
            mode === "guide_response"
              ? "border-ember-400/50 bg-ember-400/10 text-brand"
              : "border-default text-secondary hover:text-primary"
          }`}
        >
          Guide my response
        </button>
        </LearningHint>
        )}
        {/* Spec 4.3a — the 3-day observe window, made visible (§3.6). Without this,
            a first-days rep taps Start, hears nothing, and thinks it's broken. The
            coach IS working — recording + reviewing — it just isn't advising yet. */}
        {live && observing && (
          <div className="mt-3 rounded-lg border border-brand/30 bg-brand/[0.06] p-3 flex items-start gap-2">
            <Radio className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-secondary leading-relaxed">
              The coach is learning your style — it&apos;s <strong>listening this call, not coaching yet</strong>.
              Your call is still recorded and reviewed afterward. Live cues switch on after your first few days
              {observeUntil
                ? ` (${new Date(observeUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" })})`
                : ""}
              . You can still tap for help any time.
            </p>
          </div>
        )}
        {live && (
          <div className="ml-auto flex items-center gap-3">
            {/* "I'm speaking" toggle (founder 2026-07-03) — locks the current
                turns to the agent for a clean script split. Also the manual
                fallback for the single-tap gesture, which is device-dependent. */}
            <LearningHint
              as="inline-block"
              category="Sales Coach · Live coaching"
              title="&quot;I'm speaking&quot; toggle"
              whatItIs="Tells the coach that the current turn is you talking, not the prospect — so the transcript splits the two voices cleanly."
              why="A single far mic can't always tell who's speaking. Marking your own turns fixes the attribution, which is what makes the after-call review trustworthy instead of a scramble."
              how="Tap it on while you talk, off when you hand back. It's also the manual fallback for the single earpiece tap, which depends on your earbud."
              principle="Clean speaker labels now are an honest review later."
            >
            <button
              type="button"
              onClick={toggleAgentSpeaking}
              aria-pressed={agentSpeaking}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                agentSpeaking
                  ? "border-ember-400/50 bg-ember-400/10 text-brand"
                  : anchorHint
                    ? // pitch-anchor nudge: separation is struggling, draw the eye
                      "border-ember-400/60 text-secondary ring-2 ring-ember-400/40 animate-pulse"
                    : "border-default text-muted hover:text-secondary"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${agentSpeaking ? "bg-ember-400 animate-pulse" : "bg-muted"}`}
                aria-hidden
              />
              {agentSpeaking ? "You're speaking" : "I'm speaking"}
            </button>
            </LearningHint>
            {/* Auto-coach toggle — DEFAULTS OFF (founder revision 2026-07-28):
                the rep opts INTO automatic cueing. Turn it ON and it auto-cues at
                pauses until turned off; clear ON/OFF indicator (founder request). */}
            <LearningHint
              as="inline-block"
              category="Sales Coach · Live coaching"
              title="Auto-coach toggle"
              whatItIs="Lets the coach decide on its own when to cue you — it fires at natural pauses instead of waiting for you to ask."
              why="In a fast conversation you can't always tap for help. Auto-coach watches for the opening and speaks only when it reads a real moment — restraint, not chatter."
              how="Off by default — you ask for coaching yourself. Turn it ON to let cues arrive automatically at pauses; turn it OFF again for silence."
              principle="Good coaching knows when NOT to talk."
            >
            <button
              type="button"
              onClick={() => setAutoCoach(!autoCoach)}
              aria-pressed={autoCoach}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                autoCoach
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-default text-muted hover:text-secondary"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${autoCoach ? "bg-emerald-400 animate-pulse" : "bg-muted"}`}
                aria-hidden
              />
              Auto-coach {autoCoach ? "ON" : "OFF"}
            </button>
            </LearningHint>
            <LearningHint
              as="inline-block"
              category="Sales Coach · Live coaching"
              title="Coach me now"
              whatItIs="Asks the coach for a cue immediately, without waiting for it to decide on its own."
              why="Sometimes you know you need help right now — an objection you didn't expect, a stall you can't read. This is the on-demand pull for exactly those moments."
              how="Tap it the instant you feel stuck. It's the same as a double-tap on a supported earpiece."
              principle="The best moment to ask for help is the moment you notice you need it."
            >
            <button
              type="button"
              onClick={() => requestCue()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand hover:text-ember-400"
            >
              <Hand className="w-3.5 h-3.5" aria-hidden />
              Coach me now
            </button>
            </LearningHint>
          </div>
        )}
      </div>

      {/* Pitch-anchor nudge (founder 2026-07-06): only when the in-person voice
          split is genuinely struggling and the rep hasn't anchored it. Gentle,
          actionable, self-clearing — §3.3 guide-don't-overtake. anchorHint is
          set by the hook only in-person + live, so no extra guard needed here. */}
      {anchorHint && !agentSpeaking && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-brand/90">
          <Hand className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
          <span>
            Hard to tell you and the prospect apart by voice right now — tap{" "}
            <strong className="font-semibold">&quot;I&apos;m speaking&quot;</strong>{" "}
            while you talk to lock your voice in and sharpen the split.
          </span>
        </p>
      )}

      {/* Build 5 — earpiece tap control on its OWN row so it doesn't crowd the
          controls band (founder 2026-07-01). Content + UX unchanged — moved
          out of the mode-toggle flex row, that's the whole fix. */}
      {live && tapsSupported && (
        <LearningHint
          as="block"
          category="Sales Coach · Live coaching"
          title="Earpiece taps"
          whatItIs="Hands-free controls: tap your earbud to run the coach without touching the screen — single tap marks who's speaking, double tap pulls a cue, triple tap toggles auto-coach."
          why="Mid-conversation you can't look at a screen without the prospect noticing. Taps let you drive the coach invisibly, so the help stays between you and your ear."
          how="Learn the three gestures below. If a tap doesn't map on your earbud, use the on-screen buttons — the '✓' confirms when a tap actually reaches the app."
          principle="The best coaching is the kind the other person never sees."
        >
        <div className="mt-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Hand className="w-3 h-3 text-brand" aria-hidden />
            <span className="text-[11px] font-semibold text-secondary">
              Earpiece taps
            </span>
            {tapFlash && (
              <span className="text-[10px] text-emerald-400 ml-auto">
                ✓ tap received
              </span>
            )}
          </div>
          <ul className="mt-1 text-[10px] text-muted leading-relaxed">
            <li>
              • <span className="text-secondary">Single tap</span> → toggle{" "}
              <span className="text-secondary">I&apos;m speaking</span> — marks
              your turns for a clean script split.
            </li>
            <li>
              • <span className="text-secondary">Double tap</span> →{" "}
              <span className="text-secondary">activate the coach</span> now
              (Suggestion / Guide my response) — no delay.
            </li>
            <li>
              • <span className="text-secondary">Triple-tap</span> → toggle{" "}
              <span className="text-secondary">Auto-coach</span> on/off (quiet).
            </li>
          </ul>
        </div>
        </LearningHint>
      )}

      {/* F1: honest enforcement — gate Start on an earpiece acknowledgement. */}
      {!live && (
        <LearningHint
          as="block"
          category="Sales Coach · Live coaching"
          title="Earpiece confirmation"
          whatItIs="A required check that you're wearing an in-ear earpiece before live coaching can start."
          why="The cue plays to your device's audio output — the app can't guarantee the customer won't hear it on speakers. This is honest enforcement: we ask you to confirm the one thing the code can't verify, rather than pretend it's safe."
          how="Put your earpiece in, then check the box. Start stays disabled until you do."
          principle="When you can't guarantee a safeguard, name it — don't fake it."
        >
        <label className="flex items-start gap-2 mt-3 text-[11px] text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={earpieceOk}
            onChange={(e) => setEarpieceOk(e.target.checked)}
            className="accent-ember-400 mt-0.5"
          />
          <span>
            I have an in-ear earpiece in, so the customer can&apos;t hear my
            coaching.
          </span>
        </label>
        </LearningHint>
      )}

      {error && (
        <p role="alert" className="text-xs text-amber-300 mt-2">
          {error}
        </p>
      )}

      {/* Live mic-level meter — the same RMS that drives proximity
          attribution, shown so the agent can see they're the louder voice. */}
      {live && (
        <LearningHint
          as="block"
          category="Sales Coach · Live coaching"
          title="Mic level"
          whatItIs="A live meter of how loud you're coming through — the same loudness read the coach uses to tell your voice from the prospect's."
          why="Loudness is ONE of the signals the coach uses (alongside what's said, which leads) to tell you apart from the prospect. You wear the mic, so your voice should register — if the meter barely moves the acoustic signal is weak, though the content check still helps."
          how="Glance at it early. If it's reading 'quiet' while you talk, move the mic closer before you rely on the coaching."
          principle="Everything the coach knows starts with hearing you clearly."
        >
        <div className="mt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Mic className="w-3 h-3 text-muted" aria-hidden />
            <span className="text-[10px] uppercase tracking-widest text-muted font-bold">
              Mic level
            </span>
            <span className="text-[10px] text-muted ml-auto">
              {micLevel > 0.05 ? "picking you up" : "quiet"}
            </span>
          </div>
          <div
            className="h-2.5 rounded-full bg-base/60 border border-default overflow-hidden"
            role="meter"
            aria-valuenow={Math.round(Math.min(1, micLevel) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Microphone level"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-ember-400 to-ember-500 transition-[width] duration-100 ease-out"
              style={{ width: `${Math.round(Math.min(1, micLevel) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted mt-1">
            The coach tells you apart mainly by what&apos;s said; your voice and
            loudness help — a steady meter keeps the separation clean.
          </p>
        </div>
        </LearningHint>
      )}

      {/* Current cue + "used it" confirm (0080 cue loop). The rep's tap is
          first-party truth the After Pitch Summary prefers over inference. */}
      {/* a11y: a persistent visually-hidden live region announces each cue to
          assistive tech. The visible block below is conditionally mounted, so
          aria-live ON it would announce unreliably; a persistent region whose
          CONTENT changes is the robust pattern. `assertive` because a coaching
          cue's whole value is timeliness (the fluidity directive) — and it's the
          only assistive-tech channel when the rep runs cues visual-only (TTS off,
          e.g. on a video call so the prospect can't hear it). */}
      <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {currentCue ? `Coach cue: ${currentCue}` : ""}
      </div>
      {currentCue && (
        <LearningHint
          as="block"
          category="Sales Coach · Live coaching"
          title="The live cue + &quot;I used this&quot;"
          whatItIs="The coach's in-the-moment cue, with a button to mark when you actually used it."
          why="Marking 'I used this' is first-party truth — it tells the after-call review what actually landed, instead of the system guessing. That's what keeps the measurement honest rather than self-congratulatory."
          how="Read the cue, act on it if it fits, then tap 'I used this' so the review learns which cues helped."
          principle="Measure what you actually did, not what you were offered."
        >
        <div className="mt-3 rounded-xl border border-ember-400/30 bg-ember-400/[0.06] shadow-[0_0_28px_-12px_rgba(250,204,21,0.45)] p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-primary leading-relaxed">{currentCue}</p>
          </div>
          <div className="mt-2 flex justify-end">
            {cueMarked ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                Marked used
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void markCueUsed()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-ember-400 border border-ember-400/40 rounded-md px-2 py-0.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                I used this
              </button>
            )}
          </div>
        </div>
        </LearningHint>
      )}

      {/* Visible cue lifecycle (thinking / speaking / couldn't play …). */}
      {cueStatus && (
        <p className="mt-2 text-[11px] text-muted">{cueStatus}</p>
      )}

      {/* A2/§3.6: fluidity readout for the last call — visible without DevTools. */}
      {cueSummary && (
        <p className="mt-2 text-[11px] text-secondary">
          <span className="font-semibold text-brand">Last call:</span>{" "}
          {cueSummary}
        </p>
      )}

      {/* Rolling transcript — each turn tagged with who we think is
          speaking. Increment 1 attribution is naive alternation; the labels
          are shown so it's testable and obviously provisional (§3.4). */}
      {(live || turns.length > 0) && (
        <LearningHint
          as="block"
          category="Sales Coach · Live coaching"
          title="Rolling transcript"
          whatItIs="The live conversation as the coach hears it, each turn tagged with who it thinks is speaking — you or the prospect."
          why="Seeing the attribution as it happens makes it testable: you can catch a mislabeled turn in the moment. A dim '…' means the label is still provisional — the system shows its uncertainty instead of hiding it."
          how="Watch that your turns and the prospect's are landing on the right side. If they're swapped, the 'I'm speaking' toggle corrects it."
          principle="A system that shows its uncertainty earns the trust one that hides it can't."
        >
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-default bg-base/40 p-3 space-y-1.5">
          {turns.length === 0 && !partial && (
            <p className="text-[11px] text-muted">Listening…</p>
          )}
          {turns.map((t, i) => (
            <p key={i} className="text-xs leading-relaxed">
              <span
                className={`font-semibold ${
                  t.pending
                    ? "text-muted"
                    : t.speaker === "customer"
                      ? "text-brand"
                      : "text-secondary"
                }`}
              >
                {t.speaker === "customer" ? "Prospect" : "Salesperson"}
                {t.pending ? "…" : ""}:
              </span>{" "}
              <span className="text-secondary">{t.text}</span>
            </p>
          ))}
          {partial && (
            <p className="text-xs text-muted italic leading-relaxed">{partial}</p>
          )}
        </div>
        </LearningHint>
      )}
      {/* Mechanism explainer — Expert only (spec p4.4 strips live-coaching
          wordiness for Standard; how diarization works isn't something a rep
          needs mid-call). */}
      {!isStandard && (live || turns.length > 0) && (
        <p className="text-[10px] text-muted mt-1.5">
          Speaker labels lead with what&apos;s said (content), then use your
          voice and loudness — a dim &ldquo;…&rdquo; means the content check is
          still finishing. Cues fire when the prospect&apos;s turn ends.
        </p>
      )}

      {/* "Saving recording…" — the audio is being persisted to Storage so a failed live capture is never lost
          (founder priority 2026-08-12). This is the blocking state: the advance to After-Pitch waits for it. */}
      {savingState === "saving" && (
        <div className="mt-3 rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-3 flex items-start gap-2">
          <Radio className="w-4 h-4 text-brand shrink-0 mt-0.5 animate-pulse" aria-hidden />
          <p className="text-xs text-secondary leading-relaxed">
            Saving your recording… keeping your call safe so nothing is lost.
          </p>
        </div>
      )}

      {/* #1 fix: after Stop, the LIVE attributed turns are saved as the
          speaker-separated transcript (volume+content). Batch diarization
          can't separate a single far mic, so this is the canonical path
          in-person. */}
      {transcriptSaved && !live && savingState !== "saving" && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-secondary leading-relaxed">
            Transcript saved — speaker-separated from the live conversation.
            Generate your growth review above.
          </p>
        </div>
      )}

      {/* Fallback: the live transcript didn't save (e.g. STT captured nothing). The recorded audio has now been
          persisted to Storage on Stop (savingState), so recovery is a re-transcribe from the SAVED recording —
          no re-upload of the in-memory blob (which would double-upload against the auto-persist above). Only if
          the auto-persist FAILED do we fall back to re-uploading the client-held blob. */}
      {!transcriptSaved && !live && savingState !== "saving" && (recordingBlob || savingState === "saved") && (
        <div className="mt-3">
          <p className="text-[11px] text-muted mb-2">
            {savingState === "saved"
              ? "Live transcription didn't capture this call — but your audio was saved. Recover the transcript from it:"
              : "Live transcript didn't save — recover it from the recording:"}
          </p>
          <SessionRecordingUpload
            sessionId={sessionId}
            {...(savingState === "saved"
              ? { hasSavedRecording: true }
              : { initialBlob: recordingBlob ?? undefined })}
            onLabeled={() => {
              clearRecording();
              onRecordingSaved?.();
            }}
          />
        </div>
      )}

    </section>
  );
}
