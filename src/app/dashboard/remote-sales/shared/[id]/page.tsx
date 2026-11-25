"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { skipTo } from "@/lib/coach/remote/trim";

/**
 * A call an admin gave you access to (0336, F3.8): read-only — the player (trimmed sections skipped), the Highlights and
 * the transcript. Served only while your grant is active (/api/coach/remote/shared/[id]); every open is logged.
 */
type Shared = {
  call: { label: string | null; startedAt: string; repName: string | null };
  reason: string;
  audioUrl: string | null;
  trims: Array<{ startMs: number; endMs: number }>;
  transcript: Array<{ speaker: string; text: string; seq: number }>;
  highlights: { keyPoints: string[]; nextSteps: string[] } | null;
};
const WHO: Record<string, string> = { agent: "Rep", customer: "Customer" };

export default function SharedCallPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Shared | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/shared/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setErr((j as { error?: string }).error ?? "Couldn't open the call.");
        else setD(j as Shared);
      })
      .catch(() => live && setErr("Couldn't reach the server."));
    return () => {
      live = false;
    };
  }, [id]);

  if (err) return <p className="p-6 text-sm text-secondary">{err}</p>;
  if (!d)
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening the call…
      </p>
    );
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-primary">{d.call.label ?? "A call"}</h1>
        <p className="text-xs text-muted">
          {new Date(d.call.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          {d.call.repName ? ` · ${d.call.repName}` : ""}
        </p>
        <p className="mt-1 text-xs text-secondary">Shared with you by an admin: {d.reason}. Read-only; your opens are logged.</p>
      </header>
      {d.audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- the transcript below is the caption.
        <audio
          ref={audio}
          src={d.audioUrl}
          controls
          className="w-full"
          onTimeUpdate={(e) => {
            const past = skipTo(e.currentTarget.currentTime * 1000, d.trims.map((t) => ({ start_ms: t.startMs, end_ms: t.endMs })));
            if (past !== null) e.currentTarget.currentTime = past / 1000;
          }}
        />
      ) : (
        <p className="text-xs text-muted">No recording is saved for this call.</p>
      )}
      {d.highlights && (
        <section className="rounded-xl border border-default bg-surface p-4" aria-label="Highlights">
          <h2 className="text-sm font-semibold text-primary">Key points</h2>
          <ul className="mt-1 list-disc pl-5 text-sm text-secondary">{d.highlights.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
          <h2 className="mt-3 text-sm font-semibold text-primary">Next steps</h2>
          <ul className="mt-1 list-disc pl-5 text-sm text-secondary">{d.highlights.nextSteps.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </section>
      )}
      <section className="rounded-xl border border-default bg-surface p-4" aria-label="Transcript">
        <h2 className="text-sm font-semibold text-primary">Transcript</h2>
        {d.transcript.length === 0 ? (
          <p className="mt-1 text-xs text-muted">No transcript for this call.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {d.transcript.map((l) => (
              <li key={l.seq}>
                <span className="mr-2 text-xs font-semibold uppercase text-muted">{WHO[l.speaker] ?? "?"}</span>
                <span className="text-primary">{l.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
