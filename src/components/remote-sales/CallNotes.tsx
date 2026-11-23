"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, StickyNote } from "lucide-react";

/**
 * The rep's notes on a call (2026-11-23; 0316; Gong F9.20). The call's rep writes during or after the call; a note
 * taken live is stamped with the moment in the call and plays from there. The box says who can read notes before
 * anyone types (founder picker: the rep and their managers). Append-only: a correction is a new note.
 */
type Note = { id: number; atMs: number | null; body: string; authorName: string | null; createdAt: string };
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function CallNotes({ sessionId, onSeek }: { sessionId: string; onSeek?: (seconds: number) => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/sales-session/${sessionId}/notes`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { canWrite: boolean; notes: Note[]; notReady?: string };
      setNotes(j.notes);
      setCanWrite(j.canWrite);
      setNotReady(j.notReady ?? null);
    } catch {
      setFailed(true);
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/sales-session/${sessionId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the note.");
      setDraft("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the note.");
    } finally {
      setBusy(false);
    }
  };

  if (notReady) return null;
  if (failed) return <p className="rounded-xl border border-default bg-surface p-3 text-xs text-muted">Couldn&apos;t load the notes on this call.</p>;
  if (!notes) return null;
  if (!canWrite && notes.length === 0) return null;
  return (
    <section aria-label="Call notes" className="rounded-xl border border-default bg-surface p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <StickyNote className="h-4 w-4 text-brand" aria-hidden /> Notes
      </h3>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              {n.atMs !== null && onSeek ? (
                <button type="button" onClick={() => onSeek(n.atMs! / 1000)} aria-label={`Play from ${clock(n.atMs)}`} className="mr-2 text-xs tabular-nums text-muted hover:text-primary">
                  {clock(n.atMs)}
                </button>
              ) : n.atMs !== null ? (
                <span className="mr-2 text-xs tabular-nums text-muted">{clock(n.atMs)}</span>
              ) : null}
              <span className="whitespace-pre-wrap text-secondary">{n.body}</span>
              <span className="ml-2 text-[11px] text-muted">
                {n.authorName ?? ""} · {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="mt-2 space-y-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            maxLength={2000}
            rows={2}
            placeholder="Jot something down — during the call it's stamped with the moment"
            aria-label="New note"
            className="w-full rounded-lg border border-default bg-base px-2 py-1.5 text-sm text-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !draft.trim()} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Add note
            </button>
            <span className="text-[11px] text-muted">Your managers can read your notes on this call. Long numbers are removed.</span>
          </div>
          {err && <p className="text-xs text-amber-700 dark:text-amber-300">{err}</p>}
        </div>
      )}
    </section>
  );
}
