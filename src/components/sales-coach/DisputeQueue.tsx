"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Flag, AlertTriangle, Check } from "lucide-react";
import type { DisputeRow } from "@/lib/coach/pitchScore/readDisputes";

/**
 * The manager's side of a dispute.
 *
 * WHY IT EXISTS. The rep-facing dispute shipped first, and it told reps "this goes to your
 * manager" while no manager had anywhere to read it. That is the same dead end the dispute itself
 * was built to close, displaced one step — and displacing a dead end is not closing it. This is
 * the other half.
 *
 * WHAT IT DELIBERATELY CANNOT DO: change a score. A manager who genuinely mis-scored re-scores
 * the pitch, which is a separate and visible action. If replying could adjust points, the
 * leaderboard would become quietly editable by whoever handles the most complaints, and the
 * number would stop meaning anything. The copy says so, because a manager who assumes otherwise
 * will reply and believe the rep's score changed.
 *
 * Empty and failed are DIFFERENT states, and the distinction is the point: "no open disputes" is
 * something a manager acts on by closing the tab, which is the worst possible response to a queue
 * that is actually full and merely unreadable.
 */

const ENDPOINT = "/api/coach/sales-session/pitch-score/disputes";

type State =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; disputes: DisputeRow[] };

/** Short, human date for a filed-at timestamp. */
function filedAtLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " · " +
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function mmss(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(Math.floor(totalSeconds % 60)).padStart(2, "0")}`;
}

export function DisputeQueue({ repName }: { repName?: (repId: string) => string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [showAnswered, setShowAnswered] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`${ENDPOINT}${showAnswered ? "?includeAnswered=1" : ""}`);
      if (!res.ok) {
        setState({ kind: "failed" });
        return;
      }
      const body = (await res.json()) as { disputes: DisputeRow[] };
      setState({ kind: "ready", disputes: body.disputes ?? [] });
    } catch {
      setState({ kind: "failed" });
    }
  }, [showAnswered]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount =
    state.kind === "ready" ? state.disputes.filter((d) => d.open).length : null;

  return (
    <section className="rounded-2xl border border-default bg-base p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Flag className="w-4 h-4 text-brand" aria-hidden />
          Score disputes
          {openCount !== null && openCount > 0 && (
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
              {openCount} open
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowAnswered((v) => !v)}
          className="text-[11px] font-semibold text-brand hover:underline"
        >
          {showAnswered ? "Open only" : "Show answered"}
        </button>
      </header>

      {state.kind === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      )}

      {state.kind === "failed" && (
        // NOT an empty state. A manager who reads "no disputes" closes the tab.
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-start gap-2 text-xs text-primary">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              The dispute queue could not be loaded. This is not the same as having none — do not
              assume it is empty.
            </span>
          </p>
          <button type="button" onClick={load} className="mt-2 text-[11px] font-semibold text-brand hover:underline">
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && state.disputes.length === 0 && (
        <p className="text-xs text-muted">
          {showAnswered ? "No disputes have been filed." : "No open disputes."}
        </p>
      )}

      {state.kind === "ready" && state.disputes.length > 0 && (
        <ul className="space-y-3">
          {state.disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} repName={repName} onAnswered={load} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DisputeCard({
  dispute,
  repName,
  onAnswered,
}: {
  dispute: DisputeRow;
  repName?: (repId: string) => string;
  onAnswered: () => void;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async () => {
    if (!note.trim() || sending) return;
    setSending(true);
    setFailed(false);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchId: dispute.pitchId,
          ...(dispute.itemId ? { itemId: dispute.itemId } : {}),
          note: note.trim(),
        }),
      });
      // Only a confirmed 200 counts. Reporting a reply as saved when it was not leaves the rep in
      // silence — the exact state filing a dispute was meant to end.
      if (res.ok) onAnswered();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const who = repName?.(dispute.repId) ?? "A rep";

  return (
    <li className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-primary">
          {who} disputed{" "}
          {dispute.itemLabel ? (
            <span className="text-brand">{dispute.itemLabel}</span>
          ) : (
            <span className="text-brand">the whole score</span>
          )}
          {dispute.timestampS != null && (
            <span className="text-muted"> · at {mmss(dispute.timestampS)}</span>
          )}
        </p>
        <span className="shrink-0 text-[10px] text-muted">{filedAtLabel(dispute.filedAt)}</span>
      </div>

      {/* The rep filed this on somebody else's behalf. Saying so prevents the wrong conversation. */}
      {dispute.actorId && dispute.actorId !== dispute.repId && (
        <p className="mt-1 text-[10px] text-muted">Filed by someone other than the rep.</p>
      )}

      <p className="mt-2 text-[12px] text-secondary leading-relaxed whitespace-pre-wrap">
        {dispute.note}
      </p>

      {dispute.answer ? (
        <div className="mt-3 rounded-lg border border-default bg-base/40 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <Check className="w-3 h-3" aria-hidden />
            Answered
          </p>
          <p className="mt-1 text-[12px] text-secondary whitespace-pre-wrap">{dispute.answer.note}</p>
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            aria-label={`Reply to this dispute`}
            placeholder="What did you find when you listened back?"
            className="w-full rounded-lg border border-default bg-base p-2.5 text-[12px] text-primary"
          />
          {failed && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              That didn&apos;t save. Nothing was recorded — please try again.
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            {/* Stated, not implied. A manager who assumes replying adjusts the score will reply
                and believe the rep's number changed. */}
            <p className="text-[10px] text-muted">
              Replying does not change the score. Re-score the pitch if the grade was wrong.
            </p>
            <button
              type="button"
              onClick={send}
              disabled={!note.trim() || sending}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-ember-400 px-3 py-1.5 text-[12px] font-semibold text-ink-950 hover:bg-ember-500 disabled:opacity-50"
            >
              {sending && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
              Reply
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
