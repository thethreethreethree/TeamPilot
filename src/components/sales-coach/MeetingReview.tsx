"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * MeetingReview — the post-meeting Dissect surface (Phase 6). Fetches (and, on first view, generates) the
 * meeting's review from POST /api/coach/meeting-session/[id]/dissect and renders the meeting's CONSEQUENCES:
 * decisions reached, actions with owners (owner-less flagged — the #1 failure), open items, effectiveness.
 * §3.5: this shows what the MEETING produced; it never grades the coach's cues. Theme-token colors (legible in
 * light + dark). The transcription+analysis takes a moment, so the first view shows an honest "analyzing" state.
 */
type Dissect = {
  decisions?: { decision: string; context?: string }[];
  actions?: { action: string; owner: string | null }[];
  open_items?: { item: string; why?: string }[];
  openItems?: { item: string; why?: string }[]; // event payload uses snake_case; the route return uses camel
  effectiveness?: { focused: boolean; note: string } | null;
  balance?: { balanced: boolean; note: string; dominantSharePct: number } | null;
  overall?: string | null;
};

export function MeetingReview({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "pending-audio">("loading");
  const [dissect, setDissect] = useState<Dissect | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  // Guard state updates after the (potentially long — batch transcription) fetch settles post-unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/coach/meeting-session/${sessionId}/dissect`, { method: "POST" });
      if (!mountedRef.current) return;
      if (res.status === 409) {
        setState("pending-audio");
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!mountedRef.current) return;
        setErrorMsg(d?.error ?? "Couldn't load the review.");
        setState("error");
        return;
      }
      const data = (await res.json()) as { dissect: Dissect };
      if (!mountedRef.current) return;
      setDissect(data.dissect ?? null);
      setState("ready");
    } catch {
      if (!mountedRef.current) return;
      setErrorMsg("Couldn't load the review.");
      setState("error");
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-muted">
        Analyzing the meeting — transcribing the recording and reading what it produced…
      </div>
    );
  }
  if (state === "pending-audio") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-sm text-secondary">
          The recording isn&apos;t ready yet — the audio may still be saving. Check back shortly.
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:border-strong"
        >
          Try again
        </button>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-sm text-red-400">{errorMsg}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:border-strong"
        >
          Retry
        </button>
      </div>
    );
  }

  const decisions = dissect?.decisions ?? [];
  const actions = dissect?.actions ?? [];
  const openItems = dissect?.openItems ?? dissect?.open_items ?? [];
  const eff = dissect?.effectiveness ?? null;
  const nothing = decisions.length === 0 && actions.length === 0 && openItems.length === 0 && !eff;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">Meeting review</h1>
        {dissect?.overall && <p className="mt-1 text-sm text-secondary">{dissect.overall}</p>}
      </div>

      {nothing && (
        <p className="text-sm text-muted">
          This meeting didn&apos;t produce clear decisions or actions to capture — a short or exploratory
          discussion. That&apos;s an honest read, not a failure.
        </p>
      )}

      {decisions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Decisions reached</h2>
          {decisions.map((d, i) => (
            <div key={i} className="rounded-lg border border-default bg-surface p-3">
              <p className="text-sm text-primary">{d.decision}</p>
              {d.context && <p className="mt-0.5 text-xs text-muted">{d.context}</p>}
            </div>
          ))}
        </section>
      )}

      {actions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Action items</h2>
          {actions.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface p-3">
              <p className="text-sm text-primary">{a.action}</p>
              {a.owner ? (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">{a.owner}</span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">no owner</span>
              )}
            </div>
          ))}
        </section>
      )}

      {openItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Left open</h2>
          {openItems.map((o, i) => (
            <div key={i} className="rounded-lg border border-default bg-surface p-3">
              <p className="text-sm text-primary">{o.item}</p>
              {o.why && <p className="mt-0.5 text-xs text-muted">{o.why}</p>}
            </div>
          ))}
        </section>
      )}

      {eff && (
        <section className="flex items-start gap-2 rounded-lg border border-default bg-surface p-3">
          <span
            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${eff.focused ? "bg-emerald-500" : "bg-amber-500"}`}
            aria-hidden
          />
          <p className="text-sm text-secondary">
            <span className="text-primary">{eff.focused ? "Focused." : "Drifted."}</span> {eff.note}
          </p>
        </section>
      )}

      {dissect?.balance && (
        <section className="flex items-start gap-2 rounded-lg border border-default bg-surface p-3">
          <span
            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${dissect.balance.balanced ? "bg-emerald-500" : "bg-amber-500"}`}
            aria-hidden
          />
          <p className="text-sm text-secondary">
            <span className="text-primary">{dissect.balance.balanced ? "Balanced." : "Uneven."}</span>{" "}
            {dissect.balance.note}
          </p>
        </section>
      )}
    </div>
  );
}
