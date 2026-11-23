"use client";

import { useCallback, useMemo, useState } from "react";
import { notesPredateCorrections } from "@/lib/coach/transcriptEdits";
import { ChevronDown, Loader2, FileText, Pencil, Search } from "lucide-react";

/**
 * SessionTranscript — a collapsible full-transcript view for a session (partner meeting 9/2, John Ramos: admin
 * access to full session transcripts for testing/feedback). Lazily fetches the segments on expand from
 * GET /segments, which is RLS-gated to the session's OWNER or a same-company admin/manager (0084) — so the rep
 * sees their own, an admin sees any of the team's, and a peer sees an honest empty. Speaker-labeled turns.
 *
 * RSS Phase 2 (Gong F9.4): a search box pinned at the top highlights matching lines, and — when the page has a
 * player and passes `onSeek` with the session's start time — tapping a line plays from it. Both are optional,
 * so every existing use renders exactly as before.
 *
 * Editable transcripts (2026-11-23, migration 0311): the call's rep and their managers can correct a line (pencil on
 * the line). A correction is a new transcript version — the original words stay, and an "edited" mark shows them.
 */

type Seg = { speaker: "agent" | "customer" | "unknown"; text: string; seq: number; spoken_at: string | null };
type Mark = { seq: number; original: string; editedAt: string; editedByName: string | null; count: number };

export function SessionTranscript({
  sessionId,
  startedAt,
  onSeek,
}: {
  sessionId: string;
  /** The session's start, to turn a line's spoken_at into seconds into the recording. */
  startedAt?: string | null;
  /** Plays the recording from a second. Omitted where there is no player. */
  onSeek?: (seconds: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [segs, setSegs] = useState<Seg[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [canEdit, setCanEdit] = useState(false);
  const [marks, setMarks] = useState<Map<number, Mark>>(new Map());
  const [notesBuiltAt, setNotesBuiltAt] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState(true); // false for a meeting or huddle: no AI notes to refresh
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<number | null>(null);
  // Corrections redo the free reads at once; the AI notes only when asked (several paid calls) — 2026-11-23.
  const [refreshing, setRefreshing] = useState<"idle" | "sending" | "sent">("idle");
  const refreshNotes = async () => {
    setRefreshing("sending");
    try {
      const r = await fetch(`/api/coach/sales-session/${sessionId}/transcript-edit`, { method: "PUT" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setNote(j.error ?? "Couldn't refresh the notes. Try again.");
        setRefreshing("idle");
        return;
      }
      setNote("Refreshing the summary, review and follow-through from the corrected transcript — reload the call in a minute to see them.");
      setRefreshing("sent");
    } catch {
      setNote("Couldn't reach the server. Try again.");
      setRefreshing("idle");
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [res, ed] = await Promise.all([
        fetch(`/api/coach/sales-session/${sessionId}/segments`),
        // The corrections are an extra layer: if they can't load, the transcript still shows, without edit controls.
        fetch(`/api/coach/sales-session/${sessionId}/transcript-edit`).catch(() => null),
      ]);
      if (res.ok) setSegs(((await res.json()).segments ?? []) as Seg[]);
      else setError(true);
      const e = ed && ed.ok ? ((await ed.json()) as { canEdit?: boolean; edits?: Mark[]; notesBuiltAt?: string | null; aiNotes?: boolean }) : null;
      setNotesBuiltAt(e?.notesBuiltAt ?? null);
      setAiNotes(e?.aiNotes !== false);
      setCanEdit(!!e?.canEdit);
      setMarks(new Map((e?.edits ?? []).map((m) => [m.seq, m])));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const save = async (seq: number) => {
    setSaving(true);
    setNote(null);
    try {
      const r = await fetch(`/api/coach/sales-session/${sessionId}/transcript-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seq, text: draft }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; changed?: boolean };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the correction.");
      setEditing(null);
      if (j.changed) {
        setNote("Saved. Keyword hits and talk stats now use the corrected words. The summary and review were written from the earlier words — regenerate them if this correction changes their meaning.");
        await load();
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't save the correction.");
    } finally {
      setSaving(false);
    }
  };

  // Whole words, case-insensitive, punctuation ignored — the same rule as keyword trackers.
  const matches = useMemo(() => {
    const q = query.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean).join(" ");
    if (!q || !segs) return new Set<number>();
    const norm = (t: string) => " " + t.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean).join(" ") + " ";
    return new Set(segs.filter((s) => norm(s.text).includes(" " + q + " ")).map((s) => s.seq));
  }, [query, segs]);
  const base = startedAt ? Date.parse(startedAt) : NaN;
  const secondsOf = (s: Seg): number | null => {
    const t = s.spoken_at ? Date.parse(s.spoken_at) : NaN;
    return Number.isFinite(t) && Number.isFinite(base) && t >= base ? (t - base) / 1000 : null;
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && segs === null && !loading) void load();
  };

  return (
    <section className="rounded-xl border border-default bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-primary"
      >
        <FileText size={16} className="text-muted" />
        Full transcript
        <ChevronDown size={16} className={`ml-auto text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-default px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading the transcript…
            </div>
          ) : error ? (
            <p className="py-4 text-sm text-amber-600 dark:text-amber-400">
              Couldn&apos;t load the transcript.{" "}
              <button type="button" onClick={() => void load()} className="font-semibold underline">
                Retry
              </button>
            </p>
          ) : segs && segs.length === 0 ? (
            <p className="py-4 text-sm text-muted">No transcript captured for this session.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <label className="sticky top-0 z-10 flex items-center gap-1.5 rounded-lg border border-default bg-base px-2 py-1">
                <Search size={14} className="text-muted" aria-hidden />
                <span className="sr-only">Search the transcript</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  placeholder="Search this call"
                  className="w-full bg-transparent text-sm text-primary outline-none"
                />
                {query.trim() && (
                  <span className="shrink-0 text-xs text-muted" aria-live="polite">
                    {matches.size} {matches.size === 1 ? "line" : "lines"}
                  </span>
                )}
              </label>
              {note && (
                <p role="status" className="rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-secondary">
                  {note}
                </p>
              )}
              {canEdit && aiNotes && refreshing !== "sent" && notesPredateCorrections([...marks.values()].map((m) => m.editedAt), notesBuiltAt) && (
                <span className="text-[11px] text-secondary">The AI notes (summary, review, follow-through) were made before your latest correction.</span>
              )}
              {canEdit && aiNotes && refreshing !== "sent" && notesPredateCorrections([...marks.values()].map((m) => m.editedAt), notesBuiltAt) && (
                <button
                  type="button"
                  disabled={refreshing === "sending"}
                  onClick={() => void refreshNotes()}
                  className="self-start rounded-lg border border-default px-2.5 py-1 text-xs text-primary hover:bg-base disabled:opacity-50"
                >
                  {refreshing === "sending" ? "Asking…" : "Refresh the AI notes with these corrections"}
                </button>
              )}
              {segs?.map((s) => (
                <p
                  key={s.seq}
                  className={`text-sm leading-relaxed ${matches.has(s.seq) ? "rounded bg-ember-400/15 px-1" : ""}`}
                >
                  {onSeek && secondsOf(s) !== null && (
                    <button
                      type="button"
                      onClick={() => onSeek(secondsOf(s)!)}
                      aria-label={`Play from ${Math.floor(secondsOf(s)! / 60)}:${String(Math.floor(secondsOf(s)! % 60)).padStart(2, "0")}`}
                      className="mr-2 text-xs tabular-nums text-muted hover:text-primary"
                    >
                      {Math.floor(secondsOf(s)! / 60)}:{String(Math.floor(secondsOf(s)! % 60)).padStart(2, "0")}
                    </button>
                  )}
                  <span
                    className={`mr-2 text-xs font-bold uppercase tracking-wide ${
                      s.speaker === "agent" ? "text-emerald-600 dark:text-emerald-400" : s.speaker === "customer" ? "text-sky-600 dark:text-sky-400" : "text-muted"
                    }`}
                  >
                    {s.speaker === "agent" ? "Rep" : s.speaker === "customer" ? "Customer" : "?"}
                  </span>
                  {editing === s.seq ? (
                    <span className="mt-1 block space-y-1">
                      <textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.currentTarget.value)}
                        maxLength={4000}
                        rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 80)))}
                        aria-label="Corrected words for this line"
                        className="w-full rounded-lg border border-default bg-base px-2 py-1 text-sm text-primary"
                      />
                      <span className="flex items-center gap-2">
                        <button type="button" disabled={saving || !draft.trim()} onClick={() => void save(s.seq)} className="rounded-lg bg-ember-400 px-2.5 py-1 text-xs font-semibold text-ink-950 disabled:opacity-50">
                          {saving ? "Saving…" : "Save correction"}
                        </button>
                        <button type="button" disabled={saving} onClick={() => setEditing(null)} className="text-xs text-muted hover:text-primary">
                          Cancel
                        </button>
                        <span className="text-[11px] text-muted">The original words stay on record.</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="text-secondary">{s.text}</span>
                      {marks.has(s.seq) && (
                        <button
                          type="button"
                          onClick={() => setShowOriginal(showOriginal === s.seq ? null : s.seq)}
                          aria-expanded={showOriginal === s.seq}
                          className="ml-1.5 text-[11px] italic text-muted underline decoration-dotted hover:text-primary"
                        >
                          edited
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(s.seq);
                            setDraft(s.text);
                            setNote(null);
                          }}
                          aria-label="Correct this line"
                          className="ml-1.5 inline-flex align-middle text-muted opacity-60 hover:text-primary hover:opacity-100"
                        >
                          <Pencil size={12} aria-hidden />
                        </button>
                      )}
                      {showOriginal === s.seq && marks.get(s.seq) && (
                        <span className="mt-0.5 block rounded bg-base px-2 py-1 text-xs text-muted">
                          Originally: “{marks.get(s.seq)!.original}” · corrected{marks.get(s.seq)!.editedByName ? ` by ${marks.get(s.seq)!.editedByName}` : ""}{" "}
                          {new Date(marks.get(s.seq)!.editedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          {marks.get(s.seq)!.count > 1 ? ` (${marks.get(s.seq)!.count} corrections)` : ""}
                        </span>
                      )}
                    </>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
