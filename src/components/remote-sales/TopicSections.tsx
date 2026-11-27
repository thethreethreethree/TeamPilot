"use client";

import { useEffect, useState } from "react";
import { Loader2, Rows3 } from "lucide-react";

/**
 * Topic sections on the call page (Gong F11.11; founder picker 2026-11-27 "On request per call"; topicSections.ts).
 * Nothing runs until someone asks: "Show topic sections" makes one AI read of this call, kept for its transcript. The
 * bar shows each section's share of the call; each section plays the call from where it starts.
 */
type Section = { label: string; fromSeq: number; toSeq: number; startMs: number | null; endMs: number | null; share: number };
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
// Brand tones only (theme rule: no red or green), alternating so neighbours read apart; each band also has its label.
const BAND = ["bg-brand/70", "bg-brand/35", "bg-brand/55", "bg-brand/20"];

export function TopicSections({ sessionId, onSeek }: { sessionId: string; onSeek?: (seconds: number) => void }) {
  const [state, setState] = useState<{ sections: Section[] | null; lines: number | null; of: number | null; hasTranscript: boolean } | "loading" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${sessionId}/topic-sections`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { sections?: Section[] | null; lines?: number | null; of?: number | null; hasTranscript?: boolean };
        if (live) setState({ sections: Array.isArray(j.sections) ? j.sections : null, lines: j.lines ?? null, of: j.of ?? null, hasTranscript: j.hasTranscript !== false });
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [sessionId]);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/coach/remote/${sessionId}/topic-sections`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sections?: Section[]; lines?: number; of?: number };
      if (!r.ok || !Array.isArray(j.sections)) throw new Error(j.error ?? "Couldn't split this call into topics.");
      setState({ sections: j.sections, lines: j.lines ?? null, of: j.of ?? null, hasTranscript: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't split this call into topics.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;
  if (state === "failed") return <p className="text-xs text-muted">Couldn&apos;t load this call&apos;s topic sections.</p>;
  if (!state.hasTranscript) return null;
  const s = state.sections;
  return (
    <section aria-label="Topic sections" className="space-y-2 rounded-xl border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Rows3 className="h-3.5 w-3.5 text-brand" aria-hidden /> Topic sections</p>
        {!s && (
          <button type="button" disabled={busy} onClick={() => void run()} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-[11px] text-primary disabled:opacity-50">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />} Show topic sections
          </button>
        )}
      </div>
      {!s ? (
        <p className="text-xs text-secondary">Split this call by what was discussed — introductions, needs, pricing, next steps. One AI read of this call, kept for it.</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full" aria-hidden>
            {s.map((x, i) => <div key={i} className={BAND[i % BAND.length]} style={{ width: `${Math.max(1, x.share * 100)}%` }} />)}
          </div>
          <ol className="space-y-1">
            {s.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`h-2 w-2 shrink-0 rounded-full ${BAND[i % BAND.length]}`} aria-hidden />
                {x.startMs !== null && onSeek ? (
                  <button type="button" onClick={() => onSeek(Math.floor(x.startMs! / 1000))} className="font-medium text-primary underline-offset-2 hover:underline">
                    {x.label} <span className="font-normal text-muted">{mmss(x.startMs!)}</span>
                  </button>
                ) : (
                  <span className="font-medium text-primary">{x.label}</span>
                )}
                <span className="text-muted">{Math.round(x.share * 100)}%</span>
              </li>
            ))}
          </ol>
          {state.lines !== null && state.of !== null && state.lines < state.of && (
            <p className="text-[11px] text-muted">These sections cover the first {state.lines} of the call&apos;s {state.of} lines.</p>
          )}
        </>
      )}
      {msg && <p className="text-xs text-amber-700 dark:text-amber-300">{msg}</p>}
    </section>
  );
}
