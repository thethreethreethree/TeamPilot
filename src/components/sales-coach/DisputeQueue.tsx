"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Flag, AlertTriangle, Check } from "lucide-react";
import type { DisputeRow } from "@/lib/coach/pitchScore/readDisputes";
import { BONUSES_BY_ID, ELEMENTS_BY_ID, VIOLATIONS_BY_ID } from "@/lib/coach/pitchScore/rubric";

/**
 * The manager's side of a dispute.
 *
 * WHY IT EXISTS. The rep-facing dispute shipped first, and it told reps "this goes to your
 * manager" while no manager had anywhere to read it. That is the same dead end the dispute itself
 * was built to close, displaced one step — and displacing a dead end is not closing it. This is
 * the other half.
 *
 * SUPERSEDED CONSTRAINT, recorded rather than quietly overwritten (2026-09-21). This file
 * originally read: *"WHAT IT DELIBERATELY CANNOT DO: change a score … if replying could adjust
 * points, the leaderboard would become quietly editable by whoever handles the most complaints."*
 * That reasoning was sound and its conclusion was wrong, and the difference is the word QUIETLY.
 * The founder's decision the same day — and the rubric's own implementation notes (p.7), *"Manager
 * override: managers can adjust any bonus or violation, with the change logged"* — is that a
 * manager MAY move the number, under conditions that make it the opposite of quiet:
 *
 *   · a reason is required, at three levels, and the REP reads it on their own pitch detail;
 *   · the log is append-only, so a correction cannot later be tidied away;
 *   · the recompute runs through the same scorer, so a corrected pitch is not scored by hand.
 *
 * The original fear is still real and is still defended — just by the audit trail instead of by
 * refusal. REPLYING alone remains score-neutral, and the copy still says so, because a manager who
 * assumes a reply adjusts the score will leave the rep's number wrong while believing they fixed
 * it. Correcting is now a separate, explicit action on the same card.
 *
 * Empty and failed are DIFFERENT states, and the distinction is the point: "no open disputes" is
 * something a manager acts on by closing the tab, which is the worst possible response to a queue
 * that is actually full and merely unreadable.
 */

const ENDPOINT = "/api/coach/sales-session/pitch-score/disputes";
const OVERRIDE_ENDPOINT = "/api/coach/sales-session/pitch-score/override";

/**
 * Which vocabulary an item id belongs to, asked of the rubric rather than parsed from the id.
 *
 * The id happens to be prefixed (`close.paperwork`, `bonus.directv`, `viol.talkingOver`) and
 * splitting on the dot would work today. It would also be a second, silent definition of what
 * makes something a bonus — and the day a rubric adds an element under a new prefix, the UI would
 * offer the wrong controls for it while every test still passed (§2.2). The rubric is the
 * authority; this asks it.
 *
 * Null means the current rubric does not know the id: a retired item, or a whole-score dispute.
 * Either way there is nothing safe to correct, and the server would refuse it anyway.
 */
function itemKindOf(itemId: string | null): "element" | "bonus" | "violation" | null {
  if (!itemId) return null;
  if (ELEMENTS_BY_ID.has(itemId)) return "element";
  if (BONUSES_BY_ID.has(itemId)) return "bonus";
  if (VIOLATIONS_BY_ID.has(itemId)) return "violation";
  return null;
}

/** What a manager can set an item to, by kind. Mirrors the route's own enum. */
const VALUE_OPTIONS: Record<"element" | "bonus" | "violation", { value: string; label: string }[]> = {
  element: [
    { value: "hit", label: "Hit" },
    { value: "partial", label: "Partial" },
    { value: "missed", label: "Missed" },
  ],
  bonus: [
    { value: "awarded", label: "Award it" },
    { value: "removed", label: "Take it back" },
  ],
  violation: [
    { value: "awarded", label: "It stands" },
    { value: "removed", label: "Clear it" },
  ],
};

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
  const [newValue, setNewValue] = useState("");
  /**
   * The one state worth naming. A correction that landed while the reply failed is NOT a failure
   * and must not be reported as one: the score really did move, the log really does have the
   * reason, and the rep will read both on their own pitch detail. Telling the manager "that didn't
   * save" here would invite them to do it twice, and the second one is a second logged override on
   * a score that was already correct.
   */
  const [correctedButUnreplied, setCorrectedButUnreplied] = useState(false);

  const kind = itemKindOf(dispute.itemId);

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

  /**
   * Correct the item, then answer the dispute — in that order, and the order is the design.
   *
   * The correction is the thing the rep is owed; the reply is how they hear about it in the queue
   * they filed from. If the order were reversed, a failed correction would leave a reply on record
   * saying the score was fixed when it was not, which is a worse lie than silence.
   *
   * The manager's note IS the reason. Making them type the same sentence twice is how a required
   * field becomes "asdf" — and this particular required field is the one the rep reads.
   */
  const correct = async () => {
    if (!note.trim() || !newValue || !kind || !dispute.itemId || sending) return;
    setSending(true);
    setFailed(false);
    setCorrectedButUnreplied(false);
    try {
      const res = await fetch(OVERRIDE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchId: dispute.pitchId,
          itemType: kind,
          itemId: dispute.itemId,
          newValue,
          reason: note.trim(),
        }),
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      // The score has moved. From here nothing can un-move it, so no later failure may be
      // reported as though the correction did not happen.
      const answered = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchId: dispute.pitchId,
          ...(dispute.itemId ? { itemId: dispute.itemId } : {}),
          note: note.trim(),
        }),
      }).then((r) => r.ok, () => false);

      if (answered) onAnswered();
      else setCorrectedButUnreplied(true);
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

          {/*
            The correction control. Present only when the dispute names an item the CURRENT rubric
            knows: a whole-score dispute has no single thing to change, and a retired item cannot
            be re-graded under a rubric that no longer contains it. In both cases the manager still
            has the reply, so the card never becomes a dead end — it just cannot offer a correction
            it would not be able to make.
          */}
          {kind && (
            <div className="mt-3 rounded-lg border border-default bg-base/40 p-3">
              <label
                htmlFor={`correct-${dispute.id}`}
                className="block text-[10px] font-semibold uppercase tracking-widest text-muted"
              >
                If they&apos;re right, correct it
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  id={`correct-${dispute.id}`}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="rounded-lg border border-default bg-surface px-2 py-1.5 text-[12px] text-primary"
                >
                  <option value="">Leave as scored</option>
                  {VALUE_OPTIONS[kind].map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={correct}
                  disabled={!note.trim() || !newValue || sending}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand/50 px-3 py-1.5 text-[12px] font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                >
                  {sending && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
                  Correct and reply
                </button>
              </div>
              {/*
                The reason requirement, said before they hit the button rather than as a 400 after.
                It is also the honest description of what happens: this box becomes the sentence
                the rep reads next to their changed score.
              */}
              <p className="mt-2 text-[10px] text-muted">
                Your note becomes the reason, and {who} will see it on their pitch. Logged and
                permanent.
              </p>
            </div>
          )}

          {correctedButUnreplied && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              The score was corrected and {who} will see it. The reply didn&apos;t send — don&apos;t
              correct it again; just reply.
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            {/* Stated, not implied. A manager who assumes replying adjusts the score will reply
                and believe the rep's number changed. */}
            <p className="text-[10px] text-muted">
              Replying on its own does not change the score.
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
