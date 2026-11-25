"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Remote Sales → Protection → Hide calls by phrase (0337, F33.8; company admins). A call whose transcript contains a
 * phrase is hidden from everyone but its rep and admins — the database refuses it. Adding a phrase checks the last 90
 * days of calls; retiring one stops new hides (calls already hidden stay hidden until an admin unhides them on the
 * call). The panel renders nothing for a non-admin (the route answers 403).
 */
type P = { id: string; phrase: string; hiding: number };

export function HidePhrasesPanel() {
  const [phrases, setPhrases] = useState<P[] | null>(null);
  const [state, setState] = useState<"loading" | "hidden" | "failed" | "ok">("loading");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/hide-phrases", { cache: "no-store" });
      if (r.status === 403) return setState("hidden");
      if (!r.ok) return setState("failed");
      setPhrases(((await r.json()) as { phrases: P[] }).phrases);
      setState("ok");
    } catch {
      setState("failed");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (state === "hidden") return null;
  const send = async (method: "POST" | "DELETE", body: unknown, done: (j: { checking?: number | null }) => string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/hide-phrases", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; checking?: number | null };
      if (!r.ok) return setMsg(j.error ?? "That didn't work.");
      setMsg(done(j));
      setText("");
      await load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Hide calls by phrase">
      <h3 className="text-sm font-semibold text-primary">Hide calls by phrase</h3>
      <p className="mt-1 text-xs text-muted">
        A call that contains one of these phrases is hidden from everyone except its rep and company admins — managers and
        teammates can&apos;t open it, and it leaves lists, search and the library. Nothing is deleted; an admin can unhide a
        call from its page.
      </p>
      {state === "loading" ? (
        <p className="mt-2 text-xs text-muted">Loading…</p>
      ) : state === "failed" ? (
        <p className="mt-2 text-xs text-muted">Couldn&apos;t load hide phrases. Refresh to try again.</p>
      ) : phrases && phrases.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs">
          {phrases.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="text-primary">&ldquo;{p.phrase}&rdquo;</span>
              <span className="text-muted">· hiding {p.hiding} {p.hiding === 1 ? "call" : "calls"}</span>
              <button type="button" disabled={busy} onClick={() => void send("DELETE", { phraseId: p.id }, () => `"${p.phrase}" retired: no new calls will be hidden by it.`)} className="ml-auto text-secondary hover:text-primary">
                Retire
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-secondary">No phrases yet.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={120} placeholder="e.g. this is a personal call" aria-label="Phrase" className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
        <button type="button" disabled={busy || text.trim().length < 3} onClick={() => void send("POST", { phrase: text.trim() }, (j) => j.checking == null ? "Added. New calls are checked as they come in, but recent calls couldn't be checked — add it again later to retry." : `Added. Checking the last ${j.checking} calls for it now; new calls are checked as they come in.`)} className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-black disabled:opacity-50">
          Add phrase
        </button>
      </div>
      {msg && <p role="status" className="mt-2 text-xs text-secondary">{msg}</p>}
    </section>
  );
}
