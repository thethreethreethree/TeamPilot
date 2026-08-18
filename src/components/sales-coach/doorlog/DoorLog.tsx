"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mic, Square, DoorClosed, Check } from "lucide-react";
import {
  transition,
  type DoorLogState,
  type PitchOutcome,
} from "@/lib/coach/doorlog/stateMachine";
import { computeLocalSalesDate, deviceTimeZone } from "@/lib/coach/doorlog/salesDay";
import { createClient } from "@/lib/supabase/client";
import { useDoorRecorder } from "./useDoorRecorder";

// Online-only send. The client offline queue (IndexedDB + auto-drain) is WITHHELD for now — founder
// 2026-08-18: withhold the offline system until its build plan/structure is set, and until then keep it
// hidden and non-interfering. The dormant module is preserved at @/lib/coach/doorlog/offlineQueue for
// re-enable. Writes go straight to the server; server-side dedupe on clientKnockId keeps an accidental
// re-send idempotent, and the SERVER-side pitch-processing pipeline (worker/cron) is unaffected.
const DOOR_LOG_URL = "/api/coach/sales-session/door-log";
const AUDIO_BUCKET = "assets-v1";

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
  // Online-only: a failed send has no client retry (offline queue withheld), so it MUST be visible — a
  // silently-dropped knock/pitch that still advances the flow would read as success (the honesty thesis:
  // never dress a failure as a saved result). Set on a failed send, cleared when the next send starts.
  const [sendError, setSendError] = useState<string | null>(null);
  const recorder = useDoorRecorder();

  const tz = deviceTimeZone();
  const localDate = computeLocalSalesDate(new Date(), tz);
  const supabase = useMemo(() => createClient(), []);

  // Push pitch audio direct to storage via a signed upload target.
  const uploadCb = useCallback(
    (bucket: string, path: string, token: string, blob: Blob) =>
      supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, blob)
        .then((r) => !r.error)
        .catch(() => false),
    [supabase]
  );

  // POST a door-log write directly (online-only). Returns whether the server accepted it.
  const postDoorLog = useCallback(
    (body: Record<string, unknown>) =>
      fetch(DOOR_LOG_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => r.ok)
        .catch(() => false),
    []
  );

  // Send a pitch: sign an upload target, push the audio, then POST the pitch with its storagePath. Audio
  // failure is non-fatal — the pitch is still recorded (the Report Card shows the failure, not the Door Log).
  const sendPitch = useCallback(
    async (body: Record<string, unknown>, blob: Blob | null) => {
      let storagePath = "";
      if (blob) {
        const signRes = await fetch(DOOR_LOG_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "sign" }),
        }).catch(() => null);
        if (signRes?.ok) {
          const { storagePath: sp, token } = await signRes.json();
          if (await uploadCb(AUDIO_BUCKET, sp, token, blob)) storagePath = sp;
        }
      }
      return postDoorLog({ ...body, ...(blob ? { storagePath } : {}) });
    },
    [uploadCb, postDoorLog]
  );

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

  const newId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(performance.now())}`;

  const noAnswer = useCallback(() => {
    const id = newId();
    setSendError(null);
    void postDoorLog({ kind: "knock", outcome: "no_answer", localDate, clientKnockId: id }).then((ok) => {
      if (!ok) setSendError("That knock didn't save — check your connection and tap again.");
      void loadKpi(); // re-fetches the true count, correcting the optimistic bump on a failed send
    });
    setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
    setState((s) => transition(s, { type: "NO_ANSWER" }));
  }, [localDate, postDoorLog, loadKpi]);

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

  const save = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setSendError(null);
    const id = newId();
    // Fire-and-forget the upload + POST so the rep returns to IDLE immediately (zero waiting). Online-only:
    // there is no client retry (offline queue withheld); server dedupe on clientKnockId still prevents dups.
    // A failed send surfaces a banner (below) rather than silently dropping the pitch.
    void sendPitch(
      {
        kind: "pitch",
        outcome: pickedOutcome,
        localDate,
        name: name.trim() || defaultPitchName(),
        durationMs: recorded?.durationMs ?? null,
        clientKnockId: id,
      },
      recorded?.blob ?? null
    ).then((ok) => {
      if (!ok) setSendError("Your last pitch didn't save — check your connection and re-log it.");
      void loadKpi();
    });
    setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
    setRecorded(null);
    setName("");
    setBusy(false);
    setState((s) => transition(s, { type: "SAVE" }));
  }, [busy, pickedOutcome, localDate, name, recorded, sendPitch, loadKpi]);

  return (
    <div className="flex-1 min-h-0 bg-base flex flex-col px-4 py-6 max-w-md mx-auto w-full">
      {sendError && (
        <button
          type="button"
          onClick={() => setSendError(null)}
          className="mb-3 w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-left text-sm text-red-300 active:scale-[0.99] transition-transform"
        >
          ⚠ {sendError} <span className="text-red-400/70">(tap to dismiss)</span>
        </button>
      )}
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
