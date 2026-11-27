"use client";

import { useEffect, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { transcriptVoices, voiceLineFromRow, type TranscriptVoice } from "@/lib/coach/v5/transcriptVoices";
import { ConsentCheck, confirmRecordingConsent } from "./RecordingConsent";

/**
 * "Pick your voice" on a call that came in through the API (Engage plan E6/E10; founder picker 2026-11-27 "Rep picks it in
 * the app"). The call's words are saved as unknown voices; until its own rep says which voice is theirs, nothing scores
 * it. The rep first confirms the customer knew the call was recorded (the consent rule, "Rep confirms"), then picks:
 * with two or more voices, "this is me" on one of them; with one, "that's me" or "that's only the customer". The answer
 * goes through attribute-unlabelled (owner-only), which writes the attributed transcript and scores the call.
 * Shown only to the call's rep, and only while every line is still an unknown voice.
 */
export function PickYourVoice({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [voices, setVoices] = useState<TranscriptVoice[] | null>(null);
  // transcriptVoices is null under two voices, so a one-voice call's sample comes from its first line (review).
  const [firstLine, setFirstLine] = useState<string | null>(null);
  // Already confirmed (e.g. a live call recovered as unknown voices): not asked again, and never overwritten.
  const [consentDone, setConsentDone] = useState(false);
  const [show, setShow] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/consent`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { confirmed?: unknown }) : null))
      .then((j) => live && j?.confirmed && setConsentDone(true))
      .catch(() => {
        /* asked below; the server still requires it for an API call */
      });
    return () => {
      live = false;
    };
  }, [sessionId]);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/sales-session/${sessionId}/segments`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const d = (await r.json()) as { segments?: Array<{ speaker?: string; text?: string; source?: string | null; speaker_cluster?: string | null }> };
        const segs = d.segments ?? [];
        if (!live) return;
        setShow(segs.length > 0 && segs.every((x) => x.speaker === "unknown"));
        setVoices(transcriptVoices(segs.map(voiceLineFromRow)));
        setFirstLine(segs.find((x) => (x.text ?? "").trim())?.text?.slice(0, 160) ?? null);
      })
      .catch(() => {
        /* nothing shown: the call page still offers its other tools */
      });
    return () => {
      live = false;
    };
  }, [sessionId]);

  const answer = async (body: { agentCluster: string } | { mine: boolean }) => {
    setBusy(true);
    setErr(null);
    try {
      if (!consentDone) {
        await confirmRecordingConsent(sessionId, "upload");
        setConsentDone(true);
      }
      const r = await fetch(`/api/coach/sales-session/${sessionId}/attribute-unlabelled`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save your answer.");
      setShow(false);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save your answer.");
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;
  const many = (voices?.length ?? 0) >= 2;
  return (
    <section aria-label="Pick your voice" className="space-y-2 rounded-xl border border-brand/50 bg-brand/5 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-primary"><Mic className="h-3.5 w-3.5 text-brand" aria-hidden /> Pick your voice to score this call</p>
      <p className="text-secondary">This call was added for you and its words are transcribed. Say which voice is yours, and it will be reviewed and scored.</p>
      {!consentDone && <ConsentCheck checked={consent} onChange={setConsent} past />}
      {many ? (
        <ul className="space-y-1.5">
          {voices!.map((v, i) => (
            <li key={v.cluster} className="rounded-lg border border-default bg-surface p-2">
              <p className="text-muted">Voice {i + 1} · {v.lines} line{v.lines === 1 ? "" : "s"}</p>
              <p className="mt-0.5 text-primary">&ldquo;{v.sample}&rdquo;</p>
              <button type="button" disabled={busy || !(consent || consentDone)} onClick={() => void answer({ agentCluster: v.cluster })} className="mt-1 rounded-lg bg-brand px-2.5 py-1 font-semibold text-black disabled:opacity-50">
                This is me
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-2">
          {firstLine && <p className="w-full text-primary">&ldquo;{firstLine}&rdquo;</p>}
          <button type="button" disabled={busy || !(consent || consentDone)} onClick={() => void answer({ mine: true })} className="rounded-lg bg-brand px-2.5 py-1 font-semibold text-black disabled:opacity-50">That&apos;s me</button>
          <button type="button" disabled={busy || !(consent || consentDone)} onClick={() => void answer({ mine: false })} className="rounded-lg border border-default px-2.5 py-1 text-primary disabled:opacity-50">That&apos;s only the customer</button>
        </div>
      )}
      {busy && <p className="flex items-center gap-1 text-muted"><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…</p>}
      {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
    </section>
  );
}
