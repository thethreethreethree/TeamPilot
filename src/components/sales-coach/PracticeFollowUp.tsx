"use client";

import { useState } from "react";

/**
 * "Ask the coach about this practice" — the follow-up chat under a role-play review (RSS Phase 7, Gong F17.8). The
 * practice transcript stays in the rep's browser (role-play is ephemeral by design); each question sends it with the
 * earlier questions and answers. Nothing is saved.
 */
type Msg = { role: "rep" | "prospect"; text: string };

export function PracticeFollowUp({ messages, focus, reviewSummary }: { messages: Msg[]; focus: string | null; reviewSummary: string }) {
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (question.length < 3 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/practice-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, focus: focus ?? undefined, reviewSummary: reviewSummary || undefined, history, question }),
      });
      const j = (await r.json().catch(() => ({}))) as { answer?: string | null; error?: string };
      if (!r.ok) return setErr(j.error ?? "The coach couldn't answer.");
      setHistory((h) => [...h, { q: question, a: j.answer ?? "The coach isn't answering on this account right now." }]);
      setQ("");
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Ask about this practice">
      <p className="text-[10px] uppercase tracking-wide text-muted">Ask the coach about this practice</p>
      {history.map((h, i) => (
        <div key={i} className="space-y-1 text-xs">
          <p className="font-semibold text-primary">You: {h.q}</p>
          <p className="whitespace-pre-wrap text-secondary leading-relaxed">{h.a}</p>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask();
          }}
          maxLength={2000}
          placeholder="e.g. What should I have said when they asked about price?"
          aria-label="Question for the coach"
          className="min-w-0 flex-1 rounded-lg border border-default bg-base px-3 py-2 text-xs text-primary"
        />
        <button type="button" onClick={() => void ask()} disabled={busy || q.trim().length < 3} className="rounded-lg border border-default px-3 text-xs text-secondary hover:text-primary disabled:opacity-50">
          {busy ? "…" : "Ask"}
        </button>
      </div>
      {err && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </section>
  );
}
