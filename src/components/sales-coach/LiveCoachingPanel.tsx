"use client";

import { Radio, Square, Sparkles, Hand, Loader2 } from "lucide-react";
import { useLiveCoaching } from "@/lib/coach/v5/useLiveCoaching";

/**
 * LiveCoachingPanel — Live Sales Coach S1b surface.
 *
 * Start/stop live coaching, pick the cue mode, see the rolling
 * transcript + the current cue, and tap "coach me" on demand. The cue
 * also auto-fires at conversation pauses (the brain decides whether to
 * speak). UNTESTED on real hardware.
 */
export function LiveCoachingPanel({ sessionId }: { sessionId: string }) {
  const {
    status,
    transcript,
    partial,
    currentCue,
    mode,
    setMode,
    error,
    start,
    stop,
    requestCue,
  } = useLiveCoaching(sessionId);

  const live = status === "live";

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
        </div>
        <div className="flex items-center gap-2">
          {!live ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={status === "connecting"}
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
          <button
            type="button"
            onClick={() => requestCue()}
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand hover:text-ember-400"
          >
            <Hand className="w-3.5 h-3.5" aria-hidden />
            Coach me now
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}

      {/* Current cue */}
      {currentCue && (
        <div className="mt-3 rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-3 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-primary leading-relaxed">{currentCue}</p>
        </div>
      )}

      {/* Rolling transcript */}
      {(live || transcript.length > 0) && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-default bg-base/40 p-3 space-y-1">
          {transcript.length === 0 && !partial && (
            <p className="text-[11px] text-muted">Listening…</p>
          )}
          {transcript.map((t, i) => (
            <p key={i} className="text-xs text-secondary leading-relaxed">
              {t}
            </p>
          ))}
          {partial && (
            <p className="text-xs text-muted italic leading-relaxed">{partial}</p>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted mt-2">
        The cue plays only in your earpiece — the customer never hears it. The
        live transcript here is for coaching; the saved transcript + review come
        from uploading the recording after the call.
      </p>
    </section>
  );
}
