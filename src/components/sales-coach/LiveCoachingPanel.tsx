"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Radio,
  Square,
  Sparkles,
  Hand,
  Loader2,
  CheckCircle2,
  Mic,
} from "lucide-react";
import { useTapControls } from "@/lib/coach/v5/useTapControls";
import { useLiveCoaching } from "@/lib/coach/v5/useLiveCoaching";
import { SessionRecordingUpload } from "./SessionRecordingUpload";

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
  onRecordingSaved,
}: {
  sessionId: string;
  onRecordingSaved?: () => void;
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
    cueStatus,
    phase,
    confidence,
    autoCoach,
    setAutoCoach,
    mode,
    setMode,
    error,
    start,
    stop,
    requestCue,
  } = useLiveCoaching(sessionId);

  // F1: the cue plays to the agent's default output — the code can't
  // guarantee the customer won't hear it. So gate Start on the agent
  // confirming they're on an in-ear earpiece (honest enforcement of an
  // instruction, not a false guarantee).
  const [earpieceOk, setEarpieceOk] = useState(false);

  // When the live transcript is saved, refresh the page so the
  // speaker-separated transcript + the review become available.
  useEffect(() => {
    if (transcriptSaved) onRecordingSaved?.();
  }, [transcriptSaved, onRecordingSaved]);

  const live = status === "live";

  // Build 5 — earpiece tap control (§3.3, rep-controlled). A tap → coach me;
  // triple-tap → quiet toggle. Device-dependent + unverifiable (§3.4).
  const toggleQuiet = useCallback(
    () => setAutoCoach(!autoCoach),
    [setAutoCoach, autoCoach]
  );
  const { supported: tapsSupported } = useTapControls({
    active: live,
    onCoachMe: requestCue,
    onToggleQuiet: toggleQuiet,
  });

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio
            className={`w-4 h-4 ${live ? "text-red-400 animate-pulse" : "text-muted"}`}
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
                    : "text-red-300/80"
              }`}
              title={`Signal-based read (NOT yet validated against outcomes). Fillers: ${
                confidence.fillerHigh ? "high" : "ok"
              } · Pace: ${
                confidence.rushing ? "rushing" : "steady"
              } · You're speaking ${Math.round(
                confidence.repTalkShare * 100
              )}% of recent words.`}
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
        <div className="flex items-center gap-2">
          {!live ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={status === "connecting" || !earpieceOk}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
            >
              {status === "connecting" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Radio className="w-3.5 h-3.5" aria-hidden />
              )}
              {status === "connecting" ? "Connecting…" : "Start live coaching"}
            </button>
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
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-muted">Mode:</span>
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
        {live && (
          <div className="ml-auto flex items-center gap-3">
            {/* Auto-coach toggle — stays ON (auto-cues at pauses) until you
                turn it off; clear ON/OFF indicator (founder request). */}
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
            <button
              type="button"
              onClick={() => requestCue()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand hover:text-ember-400"
            >
              <Hand className="w-3.5 h-3.5" aria-hidden />
              Coach me now
            </button>
          </div>
        )}
        {/* Build 5 — earpiece tap control. F2 (§3.4): honest that the whole
            mechanism is UNTESTED, not merely device-dependent. */}
        {live && tapsSupported && (
          <p className="text-[10px] text-muted mt-2">
            Experimental: on supported earbuds a tap may trigger “coach me” and
            a triple-tap “quiet” — untested, and the mapping varies by device.
          </p>
        )}
      </div>

      {/* F1: honest enforcement — gate Start on an earpiece acknowledgement. */}
      {!live && (
        <label className="flex items-start gap-2 mt-3 text-[11px] text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={earpieceOk}
            onChange={(e) => setEarpieceOk(e.target.checked)}
            className="accent-ember-400 mt-0.5"
          />
          <span>
            I have an in-ear earpiece in, so the customer can&apos;t hear my
            coaching. (The cue plays to your device&apos;s audio output — on
            speakers, the customer could hear it.)
          </span>
        </label>
      )}

      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}

      {/* Live mic-level meter — the same RMS that drives proximity
          attribution, shown so the agent can see they're the louder voice. */}
      {live && (
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
            You should be the louder voice — the coach uses loudness to tell
            you apart from the prospect.
          </p>
        </div>
      )}

      {/* Current cue */}
      {currentCue && (
        <div className="mt-3 rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-3 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-primary leading-relaxed">{currentCue}</p>
        </div>
      )}

      {/* Visible cue lifecycle (thinking / speaking / couldn't play …). */}
      {cueStatus && (
        <p className="mt-2 text-[11px] text-muted">{cueStatus}</p>
      )}

      {/* Rolling transcript — each turn tagged with who we think is
          speaking. Increment 1 attribution is naive alternation; the labels
          are shown so it's testable and obviously provisional (§3.4). */}
      {(live || turns.length > 0) && (
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
      )}
      {(live || turns.length > 0) && (
        <p className="text-[10px] text-muted mt-1.5">
          Speaker labels use loudness (you wear the mic, so you&apos;re louder)
          + content (a dim &ldquo;…&rdquo; means content is still classifying).
          Cues fire when the prospect&apos;s turn ends.
        </p>
      )}

      {/* #1 fix: after Stop, the LIVE attributed turns are saved as the
          speaker-separated transcript (volume+content). Batch diarization
          can't separate a single far mic, so this is the canonical path
          in-person. */}
      {transcriptSaved && !live && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-secondary leading-relaxed">
            Transcript saved — speaker-separated from the live conversation.
            Generate your growth review above.
          </p>
        </div>
      )}

      {/* Fallback: only if the live transcript didn't save (e.g. nothing was
          captured) do we offer the recording-upload + diarization path. */}
      {!transcriptSaved && recordingBlob && !live && (
        <div className="mt-3">
          <p className="text-[11px] text-muted mb-2">
            Live transcript didn&apos;t save — recover it from the recording:
          </p>
          <SessionRecordingUpload
            sessionId={sessionId}
            initialBlob={recordingBlob}
            onLabeled={() => {
              clearRecording();
              onRecordingSaved?.();
            }}
          />
        </div>
      )}

      <p className="text-[11px] text-muted mt-2">
        The transcript + growth review are built from the live conversation,
        separated by speaker and saved when you Stop.
      </p>
    </section>
  );
}
