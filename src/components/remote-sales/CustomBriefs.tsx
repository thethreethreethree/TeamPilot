"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";

/**
 * Brief templates on a call (2026-11-26, Gong F13.2; migration 0364). Pick one of the company's templates and run it:
 * each question gets an answer that cites the lines it rests on (each plays the call from there), or says the call
 * didn't discuss it. A stored run is shown as it is; running again on the same transcript returns the same answers.
 * Renders nothing when the company has no templates (or before 0364).
 */
type Template = { id: string; name: string; sections: Array<{ question: string }> };
type Answer = { question: string; answer: string; seqs: number[]; atMs?: Array<number | null> };
const NOT_DISCUSSED = "Not discussed on this call.";
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function CustomBriefs({ sessionId, onSeek }: { sessionId: string; onSeek?: (seconds: number) => void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState("");
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coach/remote/brief-templates")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { available?: boolean; templates?: Template[] }) => {
        const list = j.available ? (j.templates ?? []) : [];
        setTemplates(list);
        if (list[0]) setPicked(list[0].id);
      })
      .catch(() => setFailed(true));
  }, []);

  // The stored run for the picked template, if any.
  useEffect(() => {
    if (!picked) return;
    let live = true;
    setAnswers(null);
    setMsg(null);
    fetch(`/api/coach/remote/${sessionId}/custom-brief?templateId=${picked}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { brief?: { answers: Answer[] } | null }) => live && setAnswers(j.brief?.answers ?? null))
      .catch(() => live && setMsg("Couldn't read this call's brief."));
    return () => {
      live = false;
    };
  }, [picked, sessionId]);

  if (failed) return <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted">Couldn&apos;t load brief templates.</p>;
  if (!templates || templates.length === 0) return null;
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/coach/remote/${sessionId}/custom-brief`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: picked }) });
      const j = (await r.json().catch(() => ({}))) as { brief?: { answers: Answer[] }; error?: string };
      if (!r.ok || !j.brief) setMsg(j.error ?? "Couldn't run that brief.");
      else setAnswers(j.brief.answers);
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Briefs">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ListChecks className="h-4 w-4 text-brand" aria-hidden /> Briefs
        </p>
        <select value={picked} onChange={(e) => setPicked(e.currentTarget.value)} aria-label="Brief template" className="rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary">
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {!answers && (
          <button type="button" disabled={busy || !picked} onClick={() => void run()} className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60">
            {busy ? "Reading the call…" : "Answer from this call"}
          </button>
        )}
      </div>
      {msg && <p role="status" className="text-xs text-secondary">{msg}</p>}
      {answers && (
        <ol className="space-y-2">
          {answers.map((a, i) => (
            <li key={i} className="text-xs">
              <p className="font-semibold text-primary">{a.question}</p>
              <p className={a.answer === NOT_DISCUSSED ? "text-muted" : "text-secondary"}>{a.answer}</p>
              {a.seqs.length > 0 && (
                <p className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                  {a.seqs.map((q, k) => {
                    const at = a.atMs?.[k];
                    return typeof at === "number" && onSeek ? (
                      <button key={q} type="button" onClick={() => onSeek(at / 1000)} className="rounded border border-default px-1 text-muted hover:text-primary" title="Play from here">
                        {mmss(at)}
                      </button>
                    ) : (
                      <span key={q} className="rounded border border-default px-1 text-muted">line {q}</span>
                    );
                  })}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11px] text-muted">Each answer comes from what was said on this call and shows where; anything not discussed says so.</p>
    </section>
  );
}
