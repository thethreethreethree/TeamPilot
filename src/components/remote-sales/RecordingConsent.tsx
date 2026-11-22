"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * Recording consent on phone and video calls (founder decision 2026-11-22: "Rep confirms at Start"). Remote live calls
 * record the prospect's side too, and many places require every party's consent. Before live recording — or an upload
 * of a remote call — the rep confirms the prospect knows; the confirmation is stored per call
 * (/api/coach/remote/:id/consent, an append-only event).
 */
export const CONSENT_LINE = "Just so you know, I record my calls so I can review them and serve you better — is that okay?";

/**
 * May live recording start? The earpiece is in, and on a phone/video call the rep has confirmed the prospect knows
 * (founder 2026-11-22). ONE rule for the Start button's disabled state AND startLive itself (2026-11-23), so recording
 * cannot begin without it even if the button were bypassed. Synchronous: the share picker needs the click's activation.
 */
export function canStartLive(args: { earpieceOk: boolean; remoteCall: boolean; consentOk: boolean }): boolean {
  return args.earpieceOk && (!args.remoteCall || args.consentOk);
}

export function ConsentCheck({ checked, onChange, past = false }: { checked: boolean; onChange: (v: boolean) => void; past?: boolean }) {
  return (
    <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-secondary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-ember-400" />
      <span>
        {past ? "The prospect knew this call was recorded." : "The prospect knows this call is recorded."}{" "}
        {!past && <span className="text-muted">Say something like: “{CONSENT_LINE}”</span>}
      </span>
    </label>
  );
}

/** Store the rep's confirmation. Throws with a readable message when it could not be kept. */
export async function confirmRecordingConsent(sessionId: string, how: "live" | "upload"): Promise<void> {
  const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ how }),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Couldn't record that the prospect agreed.");
  }
}

/** On the call page: whether the rep confirmed consent for this call, and how. */
export function ConsentStatus({ sessionId }: { sessionId: string }) {
  const [c, setC] = useState<{ at: string; how: "live" | "upload" } | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/consent`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { confirmed?: { at: string; how: "live" | "upload" } | null }) => live && setC(j.confirmed ?? null))
      .catch(() => live && setC(undefined));
    return () => {
      live = false;
    };
  }, [sessionId]);
  if (c === undefined) return null;
  return (
    <p className={`flex items-center gap-1.5 text-[11px] ${c ? "text-secondary" : "text-amber-700 dark:text-amber-300"}`}>
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      {c
        ? `Recording consent confirmed by the rep ${c.how === "upload" ? "when uploading" : "at the start"} · ${new Date(c.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
        : "No recording-consent confirmation on record for this call."}
    </p>
  );
}
