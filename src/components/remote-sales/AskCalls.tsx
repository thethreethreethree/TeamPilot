"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CitedAnswer, type Citation } from "@/components/sales-coach/CitedAnswer";

/**
 * Ask the coach about a set of calls (revenue Phase 5; Gong Ask Anything on a deal or account, #14). The same Ask Coach
 * as Search and the library (/api/coach/remote/ask: up to 10 calls, every call opened through the asker's own access,
 * answers cite the lines they rest on). A deal or account passes its own calls, newest first; past 10, the newest 10 are
 * asked and the box says so.
 */
export function AskCalls({ title, calls, starters = [] }: { title: string; calls: Array<{ sessionId: string; label: string | null }>; starters?: string[] }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; citations: Citation[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const unique = [...new Map(calls.map((c) => [c.sessionId, c])).values()];
  const asked = unique.slice(0, 10);
  if (asked.length === 0) return null;
  const ask = async (question: string) => {
    if (question.trim().length < 3) return;
    setBusy(true);
    setErr(null);
    setAnswer(null);
    try {
      const r = await fetch("/api/coach/remote/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), sessionIds: asked.map((c) => c.sessionId) }) });
      const j = (await r.json().catch(() => ({}))) as { answer?: string | null; citations?: Citation[]; error?: string };
      if (!r.ok) setErr(j.error ?? "The coach couldn't answer.");
      else setAnswer({ text: j.answer ?? "The coach isn't answering on this account right now.", citations: j.citations ?? [] });
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      aria-label={title}
      className="rounded-xl border border-default bg-base/40 p-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        void ask(q);
      }}
    >
      <label className="block text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-brand" aria-hidden /> {title}</span>
        {unique.length > asked.length ? ` (the ${asked.length} most recent of ${unique.length} calls)` : ` (${asked.length} call${asked.length === 1 ? "" : "s"})`}
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={2000} placeholder="e.g. What did they say about budget?" className="mt-1 w-full rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary" />
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <button type="submit" disabled={busy || q.trim().length < 3} className="rounded-lg border border-default px-3 py-1 text-xs text-secondary hover:text-primary disabled:opacity-50">
          {busy ? "Asking…" : "Ask"}
        </button>
        {starters.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => { setQ(s); void ask(s); }} className="rounded-full border border-default px-2 py-0.5 text-[11px] text-secondary hover:text-primary disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-1 text-amber-700 dark:text-amber-300">{err}</p>}
      {answer && <CitedAnswer text={answer.text} citations={answer.citations} labelFor={(c) => asked.find((x) => x.sessionId === c.sessionId)?.label ?? "call"} />}
    </form>
  );
}
