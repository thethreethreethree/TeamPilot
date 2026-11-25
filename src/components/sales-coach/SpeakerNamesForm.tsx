"use client";

import { useState } from "react";
import type { SpeakerNames, SpeakerSide } from "@/lib/coach/remote/speakerNames";

/**
 * "Name the speakers" on a phone/video call's transcript (0343; Gong ledger F8.5): the rep's and the customer's names
 * shown instead of "Rep" / "Customer". Collapsed by default. An empty name goes back to the plain label.
 */
export function SpeakerNamesForm({ sessionId, names, onSaved }: { sessionId: string; names: SpeakerNames; onSaved: (n: SpeakerNames) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SpeakerNames>(names);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    let next: SpeakerNames = { ...names };
    try {
      for (const side of ["rep", "customer"] as SpeakerSide[]) {
        const v = (draft[side] ?? "").trim();
        if (v === (names[side] ?? "")) continue;
        const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/speaker-names`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speaker: side, name: v }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string; name?: string | null };
        if (!r.ok) {
          setMsg(j.error ?? "Couldn't save the name.");
          onSaved(next);
          return;
        }
        next = { ...next, [side]: j.name ?? undefined };
        if (!j.name) delete next[side];
      }
      onSaved(next);
      setMsg("Saved.");
      setOpen(false);
    } catch {
      setMsg("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={() => { setDraft(names); setOpen(true); }} className="text-secondary underline-offset-2 hover:text-primary hover:underline">
          Name the speakers
        </button>
        {msg && <span role="status" className="text-muted">{msg}</span>}
      </div>
    );
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-default bg-base p-2 text-xs">
      {(["rep", "customer"] as SpeakerSide[]).map((side) => (
        <label key={side} className="flex flex-col gap-0.5 text-muted">
          {side === "rep" ? "Rep" : "Customer"}
          <input
            value={draft[side] ?? ""}
            onChange={(e) => setDraft({ ...draft, [side]: e.currentTarget.value })}
            maxLength={60}
            placeholder={side === "rep" ? "e.g. Alex" : "e.g. Dana Lee"}
            className="rounded border border-default bg-surface px-2 py-1 text-primary"
          />
        </label>
      ))}
      <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-brand px-2.5 py-1 font-semibold text-black disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-muted hover:text-primary">
        Cancel
      </button>
      {msg && <span role="status" className="w-full text-muted">{msg}</span>}
    </div>
  );
}
