"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { detectF0 } from "@/lib/coach/v5/pitchSeparation";
import { deriveEnrollmentF0, MIN_VOICED_FRAMES } from "@/lib/coach/v5/voiceEnrollment";

/**
 * VoiceEnrollment — the mandatory voice-recognition gate's capture surface (partner meeting 9/2).
 *
 * The rep reads a short prompt once. We run the SAME detectF0 the live coach uses over the mic frames,
 * collect the per-frame fundamental frequency, derive the median (voiceEnrollment.deriveEnrollmentF0), and
 * POST just that NUMBER — never the audio. That reference then seeds live speaker attribution against the
 * rep's known pitch. Recording auto-stops once there's enough voiced signal (or after the cap), then submits.
 */

const PROMPT =
  "Hi, I'm reaching out about a quick opportunity for your home — do you have a moment to hear how it works?";
const SAMPLE_RATE = 16000;
const BUFFER = 2048; // ~8 F0 frames/sec at 16 kHz
const MAX_SECONDS = 8; // hard cap on the read
const ENOUGH_VOICED = MIN_VOICED_FRAMES + 20; // comfortable margin → auto-stop early once we have plenty
const VOICE_NOISE_FLOOR = 0.01;

type Phase = "loading" | "idle" | "recording" | "working" | "enrolled" | "error";

export function VoiceEnrollment() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [f0, setF0] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [voiced, setVoiced] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  // Audio graph + capture buffers, held in refs so re-renders don't touch them.
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const samplesRef = useRef<(number | null)[]>([]);
  const voicedRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-entrancy latches (adversarial-review fixes): startingRef blocks a second start() while the first is
  // still awaiting the mic-permission prompt (else two live audio graphs leak); stoppedRef makes the stop path
  // fire ONCE (else the "Done" click racing the auto-stop double-submits).
  const startingRef = useRef(false);
  const stoppedRef = useRef(false);

  const teardown = useCallback(() => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    try { procRef.current?.disconnect(); } catch { /* already gone */ }
    procRef.current = null;
    try { void ctxRef.current?.close(); } catch { /* already closed */ }
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    startingRef.current = false; // a fresh take may start once this one is fully torn down
  }, []);

  // Load current enrollment status.
  useEffect(() => {
    let live = true;
    void fetch("/api/coach/voice-enrollment")
      .then((r) => (r.ok ? r.json() : { enrolled: false, f0Hz: null }))
      .then((d) => { if (!live) return; setF0(d.f0Hz ?? null); setPhase(d.enrolled ? "enrolled" : "idle"); })
      .catch(() => { if (live) setPhase("idle"); });
    return () => { live = false; teardown(); };
  }, [teardown]);

  const submit = useCallback(async () => {
    const derived = deriveEnrollmentF0(samplesRef.current);
    if (!derived) {
      setPhase("error");
      setMessage("We didn't catch a clear enough voice. Find a quieter spot and read the line again.");
      return;
    }
    setPhase("working");
    try {
      const res = await fetch("/api/coach/voice-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(derived),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setPhase("error");
        setMessage(body?.error ?? "Couldn't save your enrollment. Please try again.");
        return;
      }
      const body = (await res.json()) as { f0Hz?: number };
      setF0(body.f0Hz ?? derived.f0Hz);
      setPhase("enrolled");
      setMessage(null);
    } catch {
      setPhase("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }, []);

  const stopAndSubmit = useCallback(() => {
    if (stoppedRef.current) return; // fire once — the Done click and the auto-stop can race
    stoppedRef.current = true;
    teardown();
    setLevel(0);
    void submit();
  }, [teardown, submit]);

  const start = useCallback(async () => {
    if (startingRef.current) return; // a second click while the permission prompt is up would leak a 2nd graph
    startingRef.current = true;
    stoppedRef.current = false;
    setMessage(null);
    samplesRef.current = [];
    voicedRef.current = 0;
    setVoiced(0);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      setPhase("error");
      setMessage("We need microphone access to enroll your voice. Allow it and try again.");
      return;
    }
    // Build the audio graph inside try/catch: if the AudioContext throws (forced sampleRate unsupported,
    // Safari autoplay quirks), the mic stream is already live — tear it down and surface an error, don't leak it.
    try {
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC({ sampleRate: SAMPLE_RATE });
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(BUFFER, 1, 1);
      procRef.current = proc;
      source.connect(proc);
      // Muted gain keeps the ScriptProcessor alive without echoing the mic to the speakers (same as the live coach).
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;
      proc.connect(muteGain);
      muteGain.connect(ctx.destination);

      setPhase("recording");
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) { const s = input[i] ?? 0; sumSq += s * s; }
        const rms = Math.sqrt(sumSq / Math.max(1, input.length));
        setLevel((prev) => prev * 0.6 + Math.min(1, rms / 0.2) * 0.4);
        if (rms > VOICE_NOISE_FLOOR) {
          const f = detectF0(input, ctx.sampleRate);
          samplesRef.current.push(f);
          if (f != null) {
            voicedRef.current += 1;
            setVoiced(voicedRef.current);
            if (voicedRef.current >= ENOUGH_VOICED) stopAndSubmit(); // plenty captured — finish early
          }
        }
      };
      // Hard cap so a silent room still ends the take (submit decides if it was enough).
      stopTimerRef.current = setTimeout(stopAndSubmit, MAX_SECONDS * 1000);
    } catch {
      teardown();
      setPhase("error");
      setMessage("Couldn't start audio capture on this device. Try a different browser or device.");
    }
  }, [stopAndSubmit, teardown]);

  const progress = Math.min(100, Math.round((voiced / ENOUGH_VOICED) * 100));

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4">
      <div className="flex items-start gap-2">
        <Mic className="w-4 h-4 text-brand mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-primary">Voice enrollment</h2>
          <p className="text-[11px] text-muted mt-0.5">
            A one-time voice check so the coach can tell your side of a conversation from the customer&apos;s. We
            store a pitch reference (a number) — never a recording of your voice.
          </p>
        </div>
      </div>

      {phase === "enrolled" ? (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" aria-hidden /> Voice enrolled{f0 ? ` · ${Math.round(f0)} Hz` : ""}
          </p>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setMessage(null); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary border border-default hover:border-strong px-3 py-1.5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Re-enroll
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-default bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted font-bold mb-1">Read this aloud</p>
            <p className="text-sm text-secondary italic">&ldquo;{PROMPT}&rdquo;</p>
          </div>

          {phase === "recording" && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-xs font-semibold text-primary">Listening…</span>
                <span className="ml-auto text-[11px] text-muted tabular-nums">{voiced}/{ENOUGH_VOICED} voiced</span>
              </div>
              {/* Mic level meter */}
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-ember-400 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
              {/* Capture progress */}
              <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {phase === "working" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Saving your voice reference…
              </span>
            ) : phase === "recording" ? (
              <button
                type="button"
                onClick={stopAndSubmit}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-strong hover:bg-white/[0.04] px-3 py-2 rounded-lg transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                disabled={phase === "loading"}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
              >
                <Mic className="w-3.5 h-3.5" aria-hidden />
                {phase === "error" ? "Try again" : "Start voice check"}
              </button>
            )}
          </div>
        </>
      )}

      {message && <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">{message}</p>}
    </section>
  );
}
