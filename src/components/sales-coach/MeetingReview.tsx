"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportMeetingReviewPdf } from "@/lib/coach/meeting/meetingReviewPdf";

// Escape hatch shown in the error/pending states so a review is never a dead-end (audit L4).
function BackToMeetingCoach() {
  return (
    <Link href="/dashboard/meeting-coach" className="mt-3 inline-block text-sm text-secondary underline hover:text-primary">
      ← Back to Meeting Coach
    </Link>
  );
}

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
  // Prep-up agenda coverage (founder 2026-08-22): did the meeting hit its goal + which must-discuss topics were
  // covered vs missed. Present only for a prepped meeting.
  agenda?: {
    goal: string;
    goalAttained: "yes" | "partial" | "no" | "unknown";
    note: string;
    topics: { text: string; covered: boolean }[];
  } | null;
  overall?: string | null;
};

// After this many consecutive 409s the pending-audio state becomes a hard TERMINAL "not recorded" (audit D5 — a
// prior version offered Try-again forever). Chunks upload DURING the call, so by review-time a 409 is almost
// always terminal; 3 tries comfortably covers the narrow window where the last chunk is still landing, so the
// false-terminal risk is low. A fresh navigation to the review remounts + resets the count, so a determined rep
// can always re-check.
const MAX_PENDING_RETRIES = 3;

export function MeetingReview({
  sessionId,
  meetingTitle,
  meetingStartedAt,
}: {
  sessionId: string;
  /** For the exported PDF header — the meeting's title + date, passed from the server page. Optional. */
  meetingTitle?: string | null;
  meetingStartedAt?: string | null;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "pending-audio" | "no-recording">("loading");
  const [dissect, setDissect] = useState<Dissect | null>(null);
  const [pdfBlocked, setPdfBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [retryable, setRetryable] = useState(true); // is the current error worth a Retry? (5xx/network yes; 4xx no — audit L3)
  const pendingRetriesRef = useRef(0); // consecutive 409s → hard terminal at MAX_PENDING_RETRIES (audit D5)
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
        pendingRetriesRef.current += 1;
        // After a few tries with no audio, stop offering an endless "Try again" and state the terminal truth.
        setState(pendingRetriesRef.current >= MAX_PENDING_RETRIES ? "no-recording" : "pending-audio");
        return;
      }
      pendingRetriesRef.current = 0; // any non-409 result ends the pending-audio sequence
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!mountedRef.current) return;
        setErrorMsg(d?.error ?? "Couldn't load the review.");
        // 5xx (incl. the 503 transient-dissect) is worth retrying; a 4xx (403 not-facilitator / 404 / 400 not-a-
        // meeting) is permanent — offering Retry there just re-fails (audit L3).
        setRetryable(res.status >= 500);
        setState("error");
        return;
      }
      const data = (await res.json()) as { dissect: Dissect };
      if (!mountedRef.current) return;
      setDissect(data.dissect ?? null);
      setState("ready");
    } catch {
      if (!mountedRef.current) return;
      pendingRetriesRef.current = 0; // a network error is a different failure, not a pending-audio tick
      setErrorMsg("Couldn't load the review.");
      setRetryable(true); // a network error is worth retrying
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
        {/* Honesty (audit D5): a 409 here can be transient (audio still stitching) OR terminal (the meeting was
            never recorded — the dissect stitches-on-demand and found no chunks, INT-1). Name the terminal
            possibility so the rep knows Try-again isn't endless; after MAX_PENDING_RETRIES it becomes the hard
            "no-recording" terminal below. */}
        <p className="text-sm text-secondary">
          The recording isn&apos;t ready yet — it may still be saving. If a couple of retries don&apos;t help, this
          meeting likely wasn&apos;t recorded — head back and start a fresh one.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:border-strong"
          >
            Try again
          </button>
          <BackToMeetingCoach />
        </div>
      </div>
    );
  }
  if (state === "no-recording") {
    // Terminal state (audit D5): after MAX_PENDING_RETRIES consecutive 409s, stop offering Try-again and state the
    // truth. Back is the escape; a fresh navigation to the review remounts + resets the counter, so a determined
    // rep can still re-check if a recording genuinely lands late.
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-sm text-secondary">
          This meeting doesn&apos;t appear to have been recorded, so there&apos;s no review to show. If you expected
          a recording, start a fresh meeting.
        </p>
        <div className="mt-3">
          <BackToMeetingCoach />
        </div>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
        <div className="flex items-center gap-4">
          {/* Retry only helps a RETRYABLE error (5xx/network/pending) — a 404/403/400 just re-fails, so gate it (audit L3). */}
          {retryable && (
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:border-strong"
            >
              Retry
            </button>
          )}
          <BackToMeetingCoach />
        </div>
      </div>
    );
  }

  const decisions = dissect?.decisions ?? [];
  const actions = dissect?.actions ?? [];
  const openItems = dissect?.openItems ?? dissect?.open_items ?? [];
  const eff = dissect?.effectiveness ?? null;
  const agenda = dissect?.agenda ?? null;
  const nothing = decisions.length === 0 && actions.length === 0 && openItems.length === 0 && !eff && !agenda;
  const GOAL_LABEL: Record<string, { text: string; cls: string }> = {
    yes: { text: "Goal achieved", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    partial: { text: "Goal partially met", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    no: { text: "Goal not met", cls: "bg-red-500/10 text-red-700 dark:text-red-300" },
    unknown: { text: "Goal outcome unclear", cls: "bg-white/5 text-muted" },
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">Meeting review</h1>
          {dissect?.overall && <p className="mt-1 text-sm text-secondary">{dissect.overall}</p>}
        </div>
        {!nothing && dissect && (
          <button
            type="button"
            onClick={() => {
              // Open the self-contained, print-ready PDF doc. If a popup blocker stops the new window, tell the
              // user how to proceed (an honest, actionable failure — not a silent no-op).
              const ok = exportMeetingReviewPdf(dissect, { title: meetingTitle ?? null, dateISO: meetingStartedAt ?? null });
              setPdfBlocked(!ok);
            }}
            className="shrink-0 rounded-lg border border-default bg-surface px-3 py-1.5 text-sm font-medium text-primary hover:bg-white/5"
          >
            Export PDF
          </button>
        )}
      </div>
      {pdfBlocked && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Your browser blocked the export window. Allow pop-ups for this site, then tap Export PDF again.
        </p>
      )}

      {nothing && (
        <p className="text-sm text-muted">
          This meeting didn&apos;t produce clear decisions or actions to capture — a short or exploratory
          discussion. That&apos;s an honest read, not a failure.
        </p>
      )}

      {agenda && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Agenda coverage</h2>
          <div className="rounded-lg border border-default bg-surface p-3">
            {agenda.goal && <p className="text-sm text-primary">Goal: {agenda.goal}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${(GOAL_LABEL[agenda.goalAttained] ?? GOAL_LABEL.unknown!).cls}`}>
                {(GOAL_LABEL[agenda.goalAttained] ?? GOAL_LABEL.unknown!).text}
              </span>
              {agenda.note && <span className="text-xs text-muted">{agenda.note}</span>}
            </div>
            {agenda.topics.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {agenda.topics.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={t.covered ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{t.covered ? "✓" : "○"}</span>
                    <span className={t.covered ? "text-primary" : "text-secondary"}>{t.text}</span>
                    {!t.covered && <span className="text-xs text-amber-600 dark:text-amber-400/80">not covered</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
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
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">{a.owner}</span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">no owner</span>
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
