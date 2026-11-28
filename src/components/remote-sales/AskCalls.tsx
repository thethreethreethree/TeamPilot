"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { CitedAnswer, type Citation } from "@/components/sales-coach/CitedAnswer";

/**
 * Ask the coach about a set of calls (revenue Phase 5; Gong Ask Anything on a deal or account, #14). The same Ask Coach
 * as Search and the library (/api/coach/remote/ask: up to 10 calls, every call opened through the asker's own access,
 * answers cite the lines they rest on). A deal or account passes its own calls, newest first; past 10, the newest 10 are
 * asked and the box says so.
 */
/**
 * `onDemand` (Engage plan E9; Gong F27.2): the company's on-demand agents, each a button that runs its saved instruction
 * over the same calls (/api/coach/remote/on-demand-agents, as the asker; the answer isn't saved). A failed list just
 * shows none — the Ask box still works.
 */
export function AskCalls({ title, calls, starters = [], onDemand = false }: { title: string; calls: Array<{ sessionId: string; label: string | null }>; starters?: string[]; onDemand?: boolean }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; citations: Citation[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; instruction: string }>>([]);
  const [ranAgent, setRanAgent] = useState<string | null>(null);
  useEffect(() => {
    if (!onDemand) return;
    let live = true;
    fetch("/api/coach/remote/on-demand-agents", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { agents?: Array<{ id: string; name: string; instruction: string }> }) : null))
      .then((j) => { if (live && Array.isArray(j?.agents)) setAgents(j.agents); })
      .catch(() => {});
    return () => { live = false; };
  }, [onDemand]);
  const unique = [...new Map(calls.map((c) => [c.sessionId, c])).values()];
  const asked = unique.slice(0, 10);
  // Engage plan E18: past 10 calls, the question can read up to 50 of them, 10 at a time, combined.
  const [deep, setDeep] = useState(false);
  const deepCalls = unique.slice(0, 50);
  if (asked.length === 0) return null;
  const ask = async (question: string, agentId?: string) => {
    if (!agentId && question.trim().length < 3) return;
    setBusy(true);
    setErr(null);
    setAnswer(null);
    setRanAgent(agentId ? (agents.find((a) => a.id === agentId)?.name ?? null) : null);
    try {
      const r = agentId
        ? await fetch("/api/coach/remote/on-demand-agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run: agentId, sessionIds: asked.map((c) => c.sessionId) }) })
        : await fetch("/api/coach/remote/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deep && deepCalls.length > 10 ? { question: question.trim(), sessionIds: deepCalls.map((c) => c.sessionId), deep: true } : { question: question.trim(), sessionIds: asked.map((c) => c.sessionId) }) });
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
        {deep && unique.length > 10 ? ` (deep: ${deepCalls.length} of ${unique.length} calls, read 10 at a time)` : unique.length > asked.length ? ` (the ${asked.length} most recent of ${unique.length} calls)` : ` (${asked.length} call${asked.length === 1 ? "" : "s"})`}
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
      {unique.length > 10 && (
        <label className="mt-1 flex items-center gap-1 text-[11px] text-secondary">
          <input type="checkbox" checked={deep} disabled={busy} onChange={(e) => setDeep(e.currentTarget.checked)} />
          Ask all {deepCalls.length} calls (deep{unique.length > 50 ? ", the newest 50" : ""}; slower, read 10 at a time)
        </label>
      )}
      {agents.length > 0 && (
        <div role="group" aria-label="On-demand agents" className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">Your team&apos;s agents:</span>
          {agents.map((a) => (
            <button key={a.id} type="button" disabled={busy} title={a.instruction} onClick={() => void ask("", a.id)} className="rounded-full border border-brand/50 px-2 py-0.5 text-[11px] text-secondary hover:text-primary disabled:opacity-50">
              {a.name}
            </button>
          ))}
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-amber-700 dark:text-amber-300">{err}</p>}
      {answer && ranAgent && <p className="mt-1 text-[11px] text-muted">{ranAgent} · not saved</p>}
      {answer && <CitedAnswer text={answer.text} citations={answer.citations} labelFor={(c) => asked.find((x) => x.sessionId === c.sessionId)?.label ?? "call"} />}
    </form>
  );
}
