"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

/**
 * "Request feedback" on a finished phone/video call (RSS Phase 4, Gong F16.1; docs/rss/docs/06-UI-SPEC.md).
 *
 * The rep's side of the coaching loop. Shown only to the call's own rep (the route says `mine`); a manager sees
 * requests in the Coach Assessment inbox instead. States, in words (never colour alone):
 *   · no request yet  → button, with an optional note for the manager;
 *   · open            → "Feedback requested — waiting on your manager";
 *   · answered        → "Your manager answered" + ask-again button (a new request, the old one stays on record);
 *                       showing it records that the rep saw the answer (feedback-seen, 0321).
 * Before migration 0278 the route says so and this renders nothing — the call page is unchanged.
 */
type Req = { id: string; createdAt: string; message: string | null; toNamedManager: boolean; open: boolean };
type Wire = { available: false } | { available: true; mine: boolean; requests: Req[] };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function FeedbackRequest({ sessionId }: { sessionId: string }) {
  const [wire, setWire] = useState<Wire | null>(null);
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/feedback-request`)
      .then(async (r) => (r.ok ? ((await r.json()) as Wire) : null))
      .then((w) => {
        if (live && w) setWire(w);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionId]);

  // The rep is looking at an answer → record it (0321), so "Your coaching this week" stops listing it. Once per view of
  // the page; best-effort — a failure only leaves the answer listed.
  const answeredShown = !!(wire && wire.available && wire.mine && wire.requests.length > 0 && !wire.requests[wire.requests.length - 1]!.open);
  useEffect(() => {
    if (!answeredShown) return;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/feedback-seen`, { method: "POST" }).catch(() => {});
  }, [answeredShown, sessionId]);

  if (!wire || !wire.available || !wire.mine) return null;
  const latest = wire.requests[wire.requests.length - 1] ?? null;

  const send = async () => {
    setSending(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/feedback-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: note.trim() || undefined }),
      });
      const j = (await r.json().catch(() => ({}))) as { request?: Req; error?: string };
      if (!r.ok || !j.request) {
        setErr(j.error ?? "Couldn't send the request.");
        return;
      }
      setWire({ ...wire, requests: [...wire.requests, j.request] });
      setWriting(false);
      setNote("");
    } catch {
      setErr("Couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-default bg-base p-4 space-y-2" aria-label="Feedback">
      {latest?.open ? (
        <p className="text-xs text-secondary">
          <span className="font-semibold text-primary">Feedback requested</span> {when(latest.createdAt)} — waiting on{" "}
          {latest.toNamedManager ? "your manager" : "your managers"}.
          {latest.message ? <span className="block text-muted mt-1">Your note: “{latest.message}”</span> : null}
        </p>
      ) : (
        <>
          {latest && (
            <p className="text-xs text-secondary">
              <span className="font-semibold text-primary">Answered.</span> Your manager responded to your request from {when(latest.createdAt)} —
              see their comments and corrections on this call.
            </p>
          )}
          {writing ? (
            <div className="space-y-2">
              <label className="block text-xs text-muted" htmlFor={`fr-${sessionId}`}>
                What would you like feedback on? (optional)
              </label>
              <textarea
                id={`fr-${sessionId}`}
                value={note}
                maxLength={2000}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. How did I handle the price objection around 4:10?"
                className="w-full rounded-lg border border-default bg-surface p-2 text-sm text-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={send}
                  className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send request"}
                </button>
                <button type="button" onClick={() => setWriting(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-primary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary hover:border-strong"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
              {latest ? "Ask for feedback again" : "Request feedback"}
            </button>
          )}
        </>
      )}
      {err && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </section>
  );
}
