"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Loader2, FileText } from "lucide-react";

/**
 * SessionTranscript — a collapsible full-transcript view for a session (partner meeting 9/2, John Ramos: admin
 * access to full session transcripts for testing/feedback). Lazily fetches the segments on expand from
 * GET /segments, which is RLS-gated to the session's OWNER or a same-company admin/manager (0084) — so the rep
 * sees their own, an admin sees any of the team's, and a peer sees an honest empty. Speaker-labeled turns.
 */

type Seg = { speaker: "agent" | "customer" | "unknown"; text: string; seq: number; spoken_at: string | null };

export function SessionTranscript({ sessionId }: { sessionId: string }) {
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
              {segs?.map((s) => (
                <p key={s.seq} className="text-sm leading-relaxed">
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
