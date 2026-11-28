"use client";

import Link from "next/link";

/**
 * A coach answer whose [n] citations are clickable (RSS Phase 6, Gong F13.9). Each resolved [n] becomes a time chip:
 * on the call's own page it plays from that moment (`onSeek`); elsewhere it links to the call at that moment.
 * An [n] the server could not resolve stays plain text — a chip always points at a real line.
 */
export type Citation = { ref: number; sessionId: string; seq: number; atMs: number | null };

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/** The answer as plain text for copying: each resolved [n] as its call time (or line), the rest unchanged. Pure. */
export function citedPlainText(text: string, citations: Citation[]): string {
  const byRef = new Map(citations.map((c) => [c.ref, c]));
  return text.replace(/\[(\d{1,4})\]/g, (m, n: string) => {
    const c = byRef.get(Number(n));
    return c ? `(${c.atMs !== null ? mmss(c.atMs) : `line ${c.seq}`})` : m;
  });
}

export function CitedAnswer({
  text,
  citations,
  onSeek,
  labelFor,
}: {
  text: string;
  citations: Citation[];
  onSeek?: (seconds: number) => void;
  labelFor?: (c: Citation) => string;
}) {
  const byRef = new Map(citations.map((c) => [c.ref, c]));
  const parts = text.split(/(\[\d{1,4}\])/g);
  return (
    <p className="whitespace-pre-wrap text-xs leading-relaxed text-secondary">
      {parts.map((p, i) => {
        const m = /^\[(\d{1,4})\]$/.exec(p);
        const c = m ? byRef.get(Number(m[1])) : undefined;
        if (!c) return <span key={i}>{p}</span>;
        const label = `${labelFor ? `${labelFor(c)} ` : ""}${c.atMs !== null ? mmss(c.atMs) : `line ${c.seq}`}`;
        const cls = "mx-0.5 inline-flex rounded border border-default px-1 text-[10px] tabular-nums text-brand hover:border-strong";
        if (onSeek && c.atMs !== null) {
          return (
            <button key={i} type="button" onClick={() => onSeek(c.atMs! / 1000)} className={cls} aria-label={`Play from ${label}`}>
              {label}
            </button>
          );
        }
        return (
          <Link key={i} href={`/dashboard/sales-coach/${c.sessionId}${c.atMs !== null ? `?t=${Math.floor(c.atMs / 1000)}` : ""}`} className={cls}>
            {label}
          </Link>
        );
      })}
    </p>
  );
}
