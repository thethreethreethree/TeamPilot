"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Rename a phone/video call (2026-11-26; Gong ledger F6.3: "user can rename … while processing"). The call's own rep
 * only — the PATCH route refuses anyone else (403). Works whether the call is still processing or finished.
 */
export function RenameCall({ sessionId, label, onRenamed }: { sessionId: string; label: string | null; onRenamed: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const name = draft.trim();
    if (!name) return setErr("Give the call a name.");
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/sales-session/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientLabel: name }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setErr(j.error ?? "Couldn't rename the call.");
      onRenamed(name);
      setOpen(false);
    } catch {
      setErr("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button type="button" onClick={() => { setDraft(label ?? ""); setOpen(true); }} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary">
        <Pencil className="h-3 w-3" aria-hidden /> Rename call
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <input value={draft} onChange={(e) => setDraft(e.currentTarget.value)} maxLength={120} aria-label="Call name" autoFocus className="min-w-0 flex-1 rounded-lg border border-default bg-surface px-2 py-1 text-primary" />
      <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-brand px-2.5 py-1 font-semibold text-black disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-muted hover:text-primary">Cancel</button>
      {err && <span role="alert" className="w-full text-amber-700 dark:text-amber-300">{err}</span>}
    </div>
  );
}
