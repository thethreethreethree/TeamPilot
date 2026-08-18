"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, Square, DoorClosed, Check } from "lucide-react";
import {
  transition,
  type DoorLogState,
  type PitchOutcome,
} from "@/lib/coach/doorlog/stateMachine";
import { computeLocalSalesDate, deviceTimeZone } from "@/lib/coach/doorlog/salesDay";
import { createClient } from "@/lib/supabase/client";
import { useDoorRecorder } from "./useDoorRecorder";

/**
 * Door Log — the field UI (Macro Mode Tab 1). Optimised for taps-per-door: two thumb-zone actions,
 * a near-empty RECORDING screen with the sound bar, 4 outcome buttons, one prefilled name field.
 * Stop → next door in ≤2 taps, zero waiting (upload/STT/analysis are all fire-and-forget on the server).
 */

const OUTCOME_LABELS: Record<PitchOutcome, string> = {
  sold: "Sold",
  go_back: "Go Back",
  non_decision_maker: "Non-Decision Maker",
  not_interested: "Not Interested",
};
const OUTCOME_ORDER: PitchOutcome[] = ["sold", "go_back", "non_decision_maker", "not_interested"];
const AUDIO_BUCKET = "assets-v1";

type Kpi = { doorsKnocked: number; sold: number; goBacks: number; notInterested: number };

function defaultPitchName(): string {
  const d = new Date();
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `${day} ${time}`;
}

export function DoorLog() {
  const [state, setState] = useState<DoorLogState>("idle");
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [name, setName] = useState("");
  const [pickedOutcome, setPickedOutcome] = useState<PitchOutcome>("sold");
  const [recorded, setRecorded] = useState<{ blob: Blob | null; durationMs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const recorder = useDoorRecorder();

  const tz = deviceTimeZone();
  const localDate = computeLocalSalesDate(new Date(), tz);

  const loadKpi = useCallback(async () => {
    try {
      const res = await fetch(`/api/coach/sales-session/door-log?date=${localDate}`);
      if (res.ok) setKpi(await res.json());
    } catch {
      /* KPI strip is best-effort; the flow never blocks on it */
    }
  }, [localDate]);

  useEffect(() => {
    void recorder.arm().then((ok) => setMicDenied(!ok));
    void loadKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (body: unknown) => {
    try {
      await fetch("/api/coach/sales-session/door-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* offline — a queued retry drains on reconnect (Q7); the UI never blocks */
    }
  }, []);

  const noAnswer = useCallback(() => {
    void send({ kind: "knock", outcome: "no_answer", localDate });
    setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
    setState((s) => transition(s, { type: "NO_ANSWER" }));
    void loadKpi();
  }, [send, localDate, loadKpi]);

  const recordPitch = useCallback(async () => {
    await recorder.start();
    setState((s) => transition(s, { type: "RECORD_PITCH" }));
  }, [recorder]);

  const stopRecord = useCallback(async () => {
    const result = await recorder.stop();
    setRecorded(result);
    setState((s) => transition(s, { type: "STOP_RECORD" }));
  }, [recorder]);

  const pickOutcome = useCallback((outcome: PitchOutcome) => {
    setPickedOutcome(outcome);
    setName(defaultPitchName());
    setState((s) => transition(s, { type: "PICK_OUTCOME", outcome }));
  }, []);

  /** Upload the audio blob direct to storage via a signed target. Returns the storagePath, or "" on failure
   *  (a failed upload still records the pitch — the Report Card shows the failure, never the Door Log). */
  const uploadAudio = useCallback(async (blob: Blob): Promise<string> => {
    try {
      const signRes = await fetch("/api/coach/sales-session/door-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "sign" }),
      });
      if (!signRes.ok) return "";
      const { storagePath, token } = await signRes.json();
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .uploadToSignedUrl(storagePath, token, blob);
      return error ? "" : storagePath;
    } catch {
      return "";
    }
  }, []);

  const save = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const blob = recorded?.blob ?? null;
    const durationMs = recorded?.durationMs ?? null;
    const storagePath = blob ? await uploadAudio(blob) : "";
    await send({
      kind: "pitch",
      outcome: pickedOutcome,
      localDate,
      name: name.trim() || defaultPitchName(),
      durationMs,
      storagePath,
    });
    setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
    setRecorded(null);
    setName("");
    setBusy(false);
    setState((s) => transition(s, { type: "SAVE" }));
    void loadKpi();
  }, [busy, recorded, uploadAudio, send, pickedOutcome, localDate, name, loadKpi]);

  return (
    <div className="min-h-screen bg-base flex flex-col px-4 py-6 max-w-md mx-auto">
      {state === "idle" && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label: "Knocked", val: kpi?.doorsKnocked ?? 0 },
            { label: "Sold", val: kpi?.sold ?? 0 },
            { label: "Go-Backs", val: kpi?.goBacks ?? 0 },
            { label: "Not Int.", val: kpi?.notInterested ?? 0 },
          ].map((t) => (
            <div key={t.label} className="glass-card p-2 text-center">
              <div className="text-xl font-bold text-primary tabular-nums">{t.val}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-end gap-4 pb-4">
        {state === "idle" && (
          <>
            {micDenied && (
              <p className="text-xs text-amber-400 text-center">
                Mic access is off — enable it to record pitches. You can still log No Answer.
              </p>
            )}
            <button
              onClick={noAnswer}
              className="w-full min-h-[72px] rounded-2xl bg-surface border border-default text-primary text-lg font-semibold active:scale-[0.98] transition-transform"
            >
              <DoorClosed className="inline w-5 h-5 mr-2 -mt-1" aria-hidden />
              No Answer
            </button>
            <button
              onClick={recordPitch}
              className="w-full min-h-[96px] rounded-2xl bg-ember-400 text-[#09090B] text-xl font-bold active:scale-[0.98] transition-transform shadow-glow"
            >
              <Mic className="inline w-6 h-6 mr-2 -mt-1" aria-hidden />
              Record Pitch
            </button>
          </>
        )}

        {state === "recording" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-3xl font-bold text-primary tabular-nums">
              {Math.floor(recorder.elapsedMs / 60000)}:
              {String(Math.floor((recorder.elapsedMs % 60000) / 1000)).padStart(2, "0")}
            </div>
            <div className="flex items-end gap-1.5 h-24" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => {
                const mid = Math.abs(i - 4);
                const h = 12 + recorder.level * 80 * (1 - mid / 6);
                return (
                  <div
                    key={i}
                    className="w-2.5 rounded-full bg-ember-400 transition-[height] duration-75"
                    style={{ height: `${Math.max(8, h)}px` }}
                  />
                );
              })}
            </div>
            <button
              onClick={stopRecord}
              className="w-full min-h-[96px] rounded-2xl bg-red-500 text-white text-xl font-bold active:scale-[0.98] transition-transform"
            >
              <Square className="inline w-6 h-6 mr-2 -mt-1" aria-hidden />
              Stop Recording
            </button>
          </div>
        )}

        {state === "outcome" && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-secondary mb-1">How did it go?</p>
            {OUTCOME_ORDER.map((o) => (
              <button
                key={o}
                onClick={() => pickOutcome(o)}
                className="w-full min-h-[64px] rounded-2xl bg-surface border border-default text-primary text-lg font-semibold active:scale-[0.98] transition-transform"
              >
                {OUTCOME_LABELS[o]}
              </button>
            ))}
          </div>
        )}

        {state === "naming" && (
          <div className="flex flex-col gap-4">
            <label htmlFor="pitch-name" className="text-sm text-secondary">
              Name this pitch ({OUTCOME_LABELS[pickedOutcome]})
            </label>
            <input
              id="pitch-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-primary text-lg focus:outline-none focus:border-ember-400/50"
            />
            <button
              onClick={save}
              disabled={busy}
              className="w-full min-h-[72px] rounded-2xl bg-ember-400 text-[#09090B] text-lg font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <Check className="inline w-5 h-5 mr-2 -mt-1" aria-hidden />
              {busy ? "Saving…" : "Save & Next Door"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
