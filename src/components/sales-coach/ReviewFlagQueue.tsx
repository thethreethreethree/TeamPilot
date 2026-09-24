"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { ReviewFlag } from "@/lib/coach/assessment/reviewFlags";
import { REVIEW_ANSWER, type ReviewAnswer } from "@/lib/coach/assessment/reviewFlags";

/**
 * "Needs your attention", item one — the rubric's one escalated violation.
 *
 * From the board `Coach Assessment  manager dashboard (web).pdf`, opened at full resolution
 * 2026-09-22, whose first attention row reads:
 *
 *     Anthony A. · Rude or dismissive flag
 *     Pitch on Thu 17 Sep, −10 applied. Confirm or remove.                     [ Review ]
 *
 * WHY THIS ONE AND NOT THE OTHER FOUR VIOLATIONS. The rubric escalates exactly one: *"Rude,
 * dismissive, or condescending to the customer −10 — Any instance; flag for manager review."* It
 * is the largest single deduction in the rubric, bigger than any bonus, and it rests on an LLM's
 * reading of someone's manner rather than on anything countable. The rubric's answer is not to
 * soften the penalty but to require that a person confirm it.
 *
 * TWO ANSWERS, ONE LOG. Confirm and Remove both write an override through
 * `apply_pitch_score_override` — the same append-only path, the same recompute, the same reason
 * requirement. Confirm re-affirms the violation at its own points: a no-op to the score and a
 * real entry in the record, which is the point. A flag that simply goes quiet tells the rep
 * nothing; a confirmation tells them a human listened and agreed.
 *
 * NOT A SECOND WRITE PATH (§2.2). This posts to the override route that already exists and is
 * already manager-gated, rather than acquiring its own endpoint for the same table.
 */

const day = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ReviewFlagQueue({
  flags,
  total,
  onReviewed,
}: {
  /**
   * Null means the read FAILED. An empty array means nothing is outstanding. **Undefined means
   * the response did not carry the field at all** — a client bundle that outlived the route it
   * was compiled against, which a browser holding its JS across a deploy produces routinely.
   *
   * All three render the same sentence, because all three mean "I do not have this list", and
   * the one thing this card must never do is render an absence as "none".
   *
   * Typed and handled rather than assumed: this is the THIRD time today a new wire field took a
   * surface down through an old response shape, after `events` and `comparison` on PatternRow. I
   * wrote the defence for those two and then wrote this field without it.
   */
  flags: ReviewFlag[] | null | undefined;
  /**
   * How many are outstanding in total, when the list above is one page of them.
   *
   * Optional on purpose — the same old-bundle case as `flags`, one field later. A client that
   * never heard of it shows the list with no count, which is what it did yesterday.
   */
  total?: number | null;
  onReviewed: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // A FAILED READ IS NOT AN EMPTY QUEUE. They render identically and mean opposite things, and on
  // this card the wrong one reads as reassurance — "nobody has been rude this week" when the
  // truth is "nobody looked".
  if (!flags) {
    return (
      <p className="text-[11px] text-red-600 dark:text-red-400">
        Rude-or-dismissive flags could not be read. This is a failed read, not a finding that there
        are none.
      </p>
    );
  }

  if (flags.length === 0) {
    return (
      // The disputes sentence belongs to the BOARD, which prints it unconditionally right after
      // rendering this queue (CoachAssessmentBoard.tsx:440). Saying it here too meant a manager
      // with no flags — the common case — read the same sentence twice in a row. Found by
      // rendering the board and looking at it (2026-09-24); no test could see it, because both
      // sentences are individually correct.
      //
      // This message is about FLAGS. Disputes are not its subject.
      <p className="text-[11px] text-muted">No rude-or-dismissive flags awaiting review.</p>
    );
  }

  const answer = async (flag: ReviewFlag, which: ReviewAnswer) => {
    const key = `${flag.pitchId}:${flag.itemId}`;
    if (busy) return;

    // A REASON IS REQUIRED BY THE SCHEMA, THE TABLE AND THE RPC — three levels, because an
    // override without one is indistinguishable from a manager editing a number they disliked.
    // Asking for it here rather than letting the route reject is the difference between a prompt
    // and an error.
    if (reasonFor !== key) {
      setReasonFor(key);
      setReason("");
      setSaid(null);
      return;
    }
    if (!reason.trim()) return;

    setBusy(key);
    setSaid(null);
    try {
      const res = await fetch("/api/coach/sales-session/pitch-score/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchId: flag.pitchId,
          itemType: "violation",
          itemId: flag.itemId,
          newValue: REVIEW_ANSWER[which],
          reason: reason.trim(),
        }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSaid(d.error ?? "The review could not be recorded.");
        return;
      }
      setReasonFor(null);
      setReason("");
      setSaid(
        which === "remove"
          ? "Removed. The pitch was rescored and the rep has been told."
          : "Confirmed. The deduction stands, and the rep can see that a person reviewed it."
      );
      // Re-read: removing changes the score, and both answers take the row out of this queue.
      onReviewed();
    } catch {
      setSaid("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  // THE LIST IS BOUNDED AND MUST SAY SO. A page of fifty presented as the whole set is a claim
  // the read cannot support, and on this card an under-count reads as "nearly done" — the same
  // reassuring-lie failure as drawing a failed read as an empty queue, one degree quieter.
  // `Math.max(0, …)` and not a `total > flags.length` guard, which a mutation probe showed to be
  // equivalent to it — the `more > 0` below already decides whether the line appears, and two
  // expressions deciding one thing is the §2.2 shape in miniature. A count and a page fetched a
  // moment apart CAN disagree, and then this floors at zero rather than printing "showing 3 of 2".
  const more = typeof total === "number" ? Math.max(0, total - flags.length) : 0;

  return (
    <div className="space-y-2">
      {more > 0 && (
        <p className="text-[11px] text-secondary">
          Showing the {flags.length} most recent of <strong className="text-primary">{total}</strong>{" "}
          flags awaiting review. Answering these reveals the next {Math.min(more, flags.length)}.
        </p>
      )}
      {flags.map((f) => {
        const key = `${f.pitchId}:${f.itemId}`;
        const asking = reasonFor === key;
        return (
          <div
            key={key}
            className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3.5 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                  {f.repName ?? f.repId.slice(0, 8)} · {f.label}
                </p>
                <p className="mt-0.5 text-[11px] text-secondary">
                  Pitch on {day(f.recordedAt)}, −{f.deduction} applied. Confirm or remove.
                  {f.atSeconds !== null && ` · at ${clock(f.atSeconds)}`}
                </p>
                {/* WHAT THE SCORER HEARD. A manager cannot judge "was this rude" from a label,
                    and the rubric requires a human judgement rather than a rubber stamp. */}
                {f.evidence && (
                  <p className="mt-1 text-[11px] italic text-muted">&ldquo;{f.evidence}&rdquo;</p>
                )}
              </div>

              {!asking && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void answer(f, "confirm")}
                  className="shrink-0 rounded-md border border-default bg-surface px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                >
                  Review
                </button>
              )}
            </div>

            {asking && (
              <div className="mt-2.5">
                <label htmlFor={`why-${key}`} className="sr-only">
                  Why
                </label>
                <input
                  id={`why-${key}`}
                  value={reason}
                  onChange={(e) => setReason(e.currentTarget.value)}
                  maxLength={1000}
                  placeholder="Why — the rep reads this."
                  className="w-full rounded-md border border-default bg-base px-2 py-1.5 text-xs text-primary"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null || !reason.trim()}
                    onClick={() => void answer(f, "remove")}
                    className="rounded-md bg-ember-400 px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-50"
                  >
                    Remove the flag
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || !reason.trim()}
                    onClick={() => void answer(f, "confirm")}
                    className="rounded-md border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                  >
                    Confirm it stands
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setReasonFor(null);
                      setReason("");
                    }}
                    className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-primary"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted">
                  Both answers are logged with your name and the reason, and the rep can read them.
                  Removing rescores the pitch.
                </p>
              </div>
            )}
          </div>
        );
      })}
      {said && <p className="text-[11px] text-muted">{said}</p>}
    </div>
  );
}
