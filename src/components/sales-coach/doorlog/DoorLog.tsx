"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mic, Square, DoorClosed, DoorOpen, Check, ClipboardList } from "lucide-react";
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

// Honest failure copy (founder 2026-08-21, honesty thesis): a failed save must NOT blame the rep's connection when
// the cause is server-side. Only a genuine network throw (the client couldn't reach us at all) mentions
// the signal; a server response (expired token already refreshed-and-retried, a 5xx, a 4xx) is "on our end".
type SaveFailReason = "network" | "server";
function saveFailMessage(what: string, reason: SaveFailReason): string {
  return reason === "network"
    ? `${what} didn't save — check your signal and try again.`
    : `${what} didn't save on our end — tap to retry.`;
}

export function DoorLog() {
  const [state, setState] = useState<DoorLogState>("idle");
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [name, setName] = useState("");
  const [pickedOutcome, setPickedOutcome] = useState<PitchOutcome>("sold");
  const [recorded, setRecorded] = useState<{ blob: Blob | null; durationMs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  // No-mic path (founder 2026-08-21): true while the rep is tagging an outcome they DIDN'T record (mic
  // unavailable / "Log Pitch"). The OUTCOME screen is shared with the recording flow, so this flag routes
  // the pick to a plain knock (no naming, no pitch row) instead of the naming→save recording path.
  const [noRecord, setNoRecord] = useState(false);
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

  // POST a door-log write with in-session resilience (founder 2026-08-21, offline queue stays withheld):
  //  • 401 → the auth token expired/rotated mid field-session (the common "our end" drop for a rep who's
  //    been knocking for hours on solid signal — NOT their connection). Refresh the session, retry once.
  //  • 5xx / network throw → transient blip; back off and retry a couple of times.
  //  • 400/403 → not retryable (bad body / no company); fail fast.
  // No IndexedDB persistence — this only survives a hiccup while the app is open, by design. Returns
  // whether the server ultimately accepted it, and (on failure) whether the last failure was network or
  // server, so the caller can show an HONEST message that doesn't misattribute a server drop to the rep.
  const postDoorLog = useCallback(
    async (body: Record<string, unknown>): Promise<{ ok: boolean; failReason: SaveFailReason }> => {
      const attempt = async (): Promise<{ ok: boolean; status: number }> => {
        try {
          const r = await fetch(DOOR_LOG_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          return { ok: r.ok, status: r.status };
        } catch {
          return { ok: false, status: 0 }; // couldn't reach us at all — genuine network
        }
      };
      let res = await attempt();
      if (res.ok) return { ok: true, failReason: "server" };
      if (res.status === 401) {
        try {
          await supabase.auth.refreshSession();
        } catch {
          /* refresh failed → fall through to the retry loop, then an honest failure */
        }
        res = await attempt();
        if (res.ok) return { ok: true, failReason: "server" };
      }
      for (let i = 0; i < 2 && (res.status === 0 || res.status >= 500); i++) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        res = await attempt();
        if (res.ok) return { ok: true, failReason: "server" };
      }
      // status 0 = never reached the server (network); anything else came FROM the server (our end).
      return { ok: false, failReason: res.status === 0 ? "network" : "server" };
    },
    [supabase]
  );

  // Send a pitch: sign an upload target, push the audio, then POST the pitch with its storagePath. Audio
  // failure is non-fatal — the pitch is still recorded (the Report Card shows the failure, not the Door Log).
  const sendPitch = useCallback(
    async (body: Record<string, unknown>, blob: Blob | null): Promise<{ ok: boolean; failReason: SaveFailReason }> => {
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
    void postDoorLog({ kind: "knock", outcome: "no_answer", localDate, clientKnockId: id }).then((r) => {
      if (!r.ok) setSendError(saveFailMessage("That knock", r.failReason));
      void loadKpi(); // re-fetches the true count, correcting the optimistic bump on a failed send
    });
    setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
    setState((s) => transition(s, { type: "NO_ANSWER" }));
  }, [localDate, postDoorLog, loadKpi]);

  // No-mic path (founder 2026-08-21): jump straight to the OUTCOME screen without recording, so a rep
  // whose mic is unavailable can still log Sold / Go-Back / Not-Interested — previously they could log
  // ONLY No-Answer. The outcome is logged as a knock (below); no audio, no pitch row, no analysis.
  const logPitchNoRecord = useCallback(() => {
    setSendError(null);
    setNoRecord(true);
    setState((s) => transition(s, { type: "LOG_OUTCOME" }));
  }, []);

  // Log a mic-less outcome as a knock (drives the KPI strip exactly like a recorded pitch's knock does),
  // then return to IDLE. No naming step — there's no recording to name.
  const logOutcomeKnock = useCallback(
    (outcome: PitchOutcome) => {
      const id = newId();
      setSendError(null);
      void postDoorLog({ kind: "knock", outcome, localDate, clientKnockId: id }).then((r) => {
        if (!r.ok) setSendError(saveFailMessage("That pitch", r.failReason));
        void loadKpi();
      });
      setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
      setNoRecord(false);
      setState("idle");
    },
    [localDate, postDoorLog, loadKpi]
  );

  const recordPitch = useCallback(async () => {
    // recorder.start() returns false when the mic is denied/unavailable. Honor it: DON'T enter a fake
    // RECORDING screen that captures nothing and then saves a silent, no-audio pitch (an error dressed as a
    // success). Surface the reason and stay on the idle screen so the rep can fix mic access or log No Answer.
    const ok = await recorder.start();
    if (!ok) {
      setMicDenied(true);
      setSendError("Can't record — turn on mic access for this site, then tap Record Pitch again.");
      return;
    }
    setSendError(null);
    setState((s) => transition(s, { type: "RECORD_PITCH" }));
  }, [recorder]);

  const stopRecord = useCallback(async () => {
    const result = await recorder.stop();
    setRecorded(result);
    setState((s) => transition(s, { type: "STOP_RECORD" }));
  }, [recorder]);

  const pickOutcome = useCallback(
    (outcome: PitchOutcome) => {
      // No-mic path: log the outcome directly as a knock and go home — skip naming (nothing was recorded).
      if (noRecord) {
        logOutcomeKnock(outcome);
        return;
      }
      setPickedOutcome(outcome);
      setName(defaultPitchName());
      setState((s) => transition(s, { type: "PICK_OUTCOME", outcome }));
    },
    [noRecord, logOutcomeKnock]
  );

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
    ).then((r) => {
      if (!r.ok) setSendError(saveFailMessage("Your last pitch", r.failReason));
      void loadKpi();
    });
    setKpi((k) => (k ? { ...k, doorsKnocked: k.doorsKnocked + 1 } : k));
    setRecorded(null);
    setName("");
    setBusy(false);
    setState((s) => transition(s, { type: "SAVE" }));
  }, [busy, pickedOutcome, localDate, name, recorded, sendPitch, loadKpi]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base flex flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 max-w-md mx-auto w-full">
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
        <div className="grid grid-cols-4 gap-2 mb-2">
          {[
            { label: "Knocked", val: kpi?.doorsKnocked ?? 0, accent: false },
            { label: "Sold", val: kpi?.sold ?? 0, accent: true },
            { label: "Go-Backs", val: kpi?.goBacks ?? 0, accent: false },
            { label: "Not Int.", val: kpi?.notInterested ?? 0, accent: false },
          ].map((t) => (
            <div
              key={t.label}
              className={`rounded-2xl border p-2.5 text-center ${
                t.accent ? "border-ember-400/40 bg-ember-400/[0.08]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className={`text-2xl font-bold tabular-nums ${t.accent ? "text-brand" : "text-primary"}`}>
                {t.val}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Field states keep the thumb-zone bottom anchor (justify-end). The NAMING state top-aligns instead:
          it has a text input, and the fixed shell doesn't resize for the mobile keyboard, so a bottom-anchored
          form is fully hidden behind the keyboard (rep can't reach Save). Top-aligned, it sits above the keyboard. */}
      <div className={`flex-1 flex flex-col gap-4 pb-4 ${state === "naming" ? "justify-start pt-2" : "justify-end"}`}>
        {state === "idle" && (
          <>
            {/* Subtle anchor fills the empty middle so the screen feels intentional, not blank — kept minimal
                so the two thumb-zone actions below stay the focus (founder: nicer, without losing simplicity). */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center select-none">
              <div className="w-16 h-16 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
                <DoorOpen className="w-7 h-7 text-brand/70" aria-hidden />
              </div>
              <p className="text-sm text-muted">Ready for the next door</p>
            </div>
            {micDenied && (
              <p className="text-xs text-amber-400 text-center">
                Mic access is off — you can still log every outcome. Turn on mic access to also record
                pitches for coaching.
              </p>
            )}
            <button
              onClick={noAnswer}
              className="w-full min-h-[68px] rounded-2xl bg-white/[0.04] border border-white/12 text-primary text-lg font-semibold active:scale-[0.98] transition-transform"
            >
              <DoorClosed className="inline w-5 h-5 mr-2 -mt-1" aria-hidden />
              No Answer
            </button>
            {/* Mic available → record + analyze the pitch. Mic unavailable → log the outcome without a
                recording (founder 2026-08-21) so a mic-less rep is never locked out of logging a sale. */}
            {micDenied ? (
              <button
                onClick={logPitchNoRecord}
                className="w-full min-h-[96px] rounded-2xl bg-ember-400 text-[#09090B] text-xl font-bold active:scale-[0.98] transition-transform shadow-glow"
              >
                <ClipboardList className="inline w-6 h-6 mr-2 -mt-1" aria-hidden />
                Log Pitch
              </button>
            ) : (
              <button
                onClick={recordPitch}
                className="w-full min-h-[96px] rounded-2xl bg-ember-400 text-[#09090B] text-xl font-bold active:scale-[0.98] transition-transform shadow-glow"
              >
                <Mic className="inline w-6 h-6 mr-2 -mt-1" aria-hidden />
                Record Pitch
              </button>
            )}
          </>
        )}

        {state === "recording" && (
          // Discreet by request (reps record at the door): a small pulsing dot + timer and a subtle "Stop"
          // pill, not a loud full-width red button that broadcasts "recording" to the prospect.
          <div className="flex-1 flex flex-col items-center justify-center gap-7">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500/80 animate-pulse" aria-hidden />
              <span className="text-2xl font-semibold text-primary tabular-nums">
                {Math.floor(recorder.elapsedMs / 60000)}:
                {String(Math.floor((recorder.elapsedMs % 60000) / 1000)).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-end gap-1 h-10" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => {
                const mid = Math.abs(i - 4);
                const h = 6 + recorder.level * 34 * (1 - mid / 6);
                return (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-ember-400/70 transition-[height] duration-75"
                    style={{ height: `${Math.max(5, h)}px` }}
                  />
                );
              })}
            </div>
            <button
              onClick={stopRecord}
              aria-label="Stop recording"
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/15 px-6 py-2.5 text-sm font-medium text-secondary active:scale-[0.97] transition-transform"
            >
              <Square className="w-3.5 h-3.5" aria-hidden /> Stop
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
