"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Loader2, FileText, Search } from "lucide-react";

/**
 * SessionTranscript — a collapsible full-transcript view for a session (partner meeting 9/2, John Ramos: admin
 * access to full session transcripts for testing/feedback). Lazily fetches the segments on expand from
 * GET /segments, which is RLS-gated to the session's OWNER or a same-company admin/manager (0084) — so the rep
 * sees their own, an admin sees any of the team's, and a peer sees an honest empty. Speaker-labeled turns.
 *
 * RSS Phase 2 (Gong F9.4): a search box pinned at the top highlights matching lines, and — when the page has a
 * player and passes `onSeek` with the session's start time — tapping a line plays from it. Both are optional,
 * so every existing use renders exactly as before.
 */

type Seg = { speaker: "agent" | "customer" | "unknown"; text: string; seq: number; spoken_at: string | null };

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/coach/sales-session/${sessionId}/segments`);
      if (res.ok) setSegs(((await res.json()).segments ?? []) as Seg[]);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

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
                  <span className="text-secondary">{s.text}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
