"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";

/**
 * Follow-through on a finished phone/video call (RSS Phase 6, Gong F26.4 + F25.11).
 *
 *   · Callbacks the customer asked for, each with the line it came from (tap the time to hear it) and
 *     "Add to Tasks" — a person confirms every to-do; the AI never creates one by itself (§3.3).
 *   · The AI's read of how the call ended appears ONLY after the rep records their own outcome (the route
 *     enforces it), as a second opinion beside theirs — agreement or not, in words.
 * Before 0281, or for an older call never read, the panel says so and offers to read it now.
 */
type Cb = { what: string; due: string | null; quote: string; seq: number; atMs: number | null; taskId: string | null };
type Read = { id: string; repOutcome: string | null; suggested: { outcome: string; why: string | null; seq: number | null } | "after-yours" | null; callbacks: Cb[] };
type Wire = { available: false; reason: string } | { available: true; remote: boolean; read: Read | null };

const OUTCOME: Record<string, string> = { sold: "Sold", follow_up: "Follow-up", no_sale: "No sale", undecided: "Undecided" };
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function FollowThroughPanel({ sessionId, onSeek }: { sessionId: string; onSeek?: (seconds: number) => void }) {
  const [wire, setWire] = useState<Wire | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/coach/remote/${encodeURIComponent(sessionId)}/follow-through`;

  useEffect(() => {
    let live = true;
    fetch(url)
      .then(async (r) => (r.ok ? ((await r.json()) as Wire) : null))
      .then((w) => live && w && setWire(w))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);

  if (!wire) return null;
  if (!wire.available) return <p className="text-xs text-muted">{wire.reason}</p>;
  if (!wire.remote) return null;

  const readNow = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(url, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as Wire & { error?: string };
      if (!r.ok) setErr(j.error ?? "Couldn't read the call.");
      else setWire(j);
    } finally {
      setBusy(false);
    }
  };
  const addTask = async (index: number) => {
    if (!wire.read) return;
    setErr(null);
    const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/callbacks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followThroughId: wire.read.id, index }),
    }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { taskId?: string; error?: string }) : {};
    if (!r?.ok || !j.taskId) return setErr(j.error ?? "Couldn't create the task.");
    const callbacks = wire.read.callbacks.map((c, i) => (i === index ? { ...c, taskId: j.taskId! } : c));
    setWire({ ...wire, read: { ...wire.read, callbacks } });
  };

  const read = wire.read;
  return (
    <section className="rounded-2xl border border-default bg-base p-4 space-y-3" aria-label="Follow-through">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <CalendarCheck className="h-4 w-4 text-brand" aria-hidden /> Follow-through
      </h2>
      {!read ? (
        <div className="text-xs text-muted space-y-2">
          <p>This call hasn&apos;t been read for callbacks yet.</p>
          <button type="button" disabled={busy} onClick={readNow} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-secondary hover:text-primary disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Read this call
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted">Callbacks said on the call</p>
            {read.callbacks.length === 0 ? (
              <p className="text-xs text-muted">No callback or promised follow-up was said on this call.</p>
            ) : (
              <ul className="space-y-1.5">
                {read.callbacks.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary">
                        {c.what}
                        <span className="ml-1 font-normal text-muted">{c.due ? `· ${day(c.due)}` : "· no day said"}</span>
                      </p>
                      <p className="text-muted">
                        {c.atMs !== null && onSeek ? (
                          <button type="button" onClick={() => onSeek(c.atMs! / 1000)} className="mr-1 tabular-nums text-brand hover:underline">{mmss(c.atMs)}</button>
                        ) : null}
                        “{c.quote}”
                      </p>
                    </div>
                    {c.taskId ? (
                      <a href={`/dashboard/operations/${c.taskId}`} className="text-brand hover:underline">In Tasks</a>
                    ) : (
                      <button type="button" onClick={() => addTask(i)} className="rounded-lg border border-default px-2 py-1 text-secondary hover:text-primary">
                        Add to Tasks
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-default pt-2 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-muted">How it ended — the AI&apos;s read</p>
            {read.suggested === "after-yours" ? (
              <p className="text-muted">Record your own outcome first; then you&apos;ll see the AI&apos;s read beside it.</p>
            ) : read.suggested === null ? (
              <p className="text-muted">The AI couldn&apos;t tell from the transcript how this call ended.</p>
            ) : (
              <p className="text-secondary">
                <span className="font-semibold text-primary">{OUTCOME[read.suggested.outcome] ?? read.suggested.outcome}</span>
                {read.repOutcome && (
                  <span className="text-muted">
                    {" "}
                    — {read.repOutcome === read.suggested.outcome ? "the same as yours" : `yours: ${OUTCOME[read.repOutcome] ?? read.repOutcome}. Yours stands; this is a second opinion`}
                  </span>
                )}
                {read.suggested.why ? <span className="block text-muted">{read.suggested.why}</span> : null}
              </p>
            )}
          </div>
        </>
      )}
      {err && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </section>
  );
}
