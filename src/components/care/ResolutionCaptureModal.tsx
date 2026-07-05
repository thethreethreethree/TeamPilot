"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2, X } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * ResolutionCaptureModal — the §1.1 + §1.6 capture moment.
 *
 * When the agent marks a conversation resolved, this modal asks
 * the two questions that turn a closed ticket into reusable
 * institutional knowledge:
 *   1. What was the actual issue?
 *   2. What worked?
 *
 * Plus an optional short category that drives pattern detection
 * (12 of these in a week → potential Problem in the §3.1 chain).
 *
 * If the agent really wants to skip, they can — but the modal
 * makes the capture the default path, not a chore tucked behind
 * a menu. The §A6 triad applies: this is the Understanding capture
 * that closes the loop on this conversation and primes the next
 * one.
 */

export function ResolutionCaptureModal({
  conversationId,
  open,
  onClose,
  onCaptured,
}: {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  onCaptured: () => void;
}) {
  const [issueSummary, setIssueSummary] = useState("");
  const [whatWorked, setWhatWorked] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (alsoResolve: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${conversationId}/resolution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueSummary: issueSummary.trim(),
            whatWorked: whatWorked.trim(),
            category: category.trim() || undefined,
            alsoMarkResolved: alsoResolve,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't capture.");
        return;
      }
      onCaptured();
      onClose();
      setIssueSummary("");
      setWhatWorked("");
      setCategory("");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    issueSummary.trim().length >= 5 && whatWorked.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base border border-default rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-default flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-brand shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-primary">
              Capture what you learned
            </h2>
            <p className="text-[11px] text-muted leading-relaxed mt-0.5">
              Two short answers. The next agent reading a similar
              conversation gets to see this on their Read Phase panel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-primary"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <LearningHint
            as="block"
            category="C.A.R.E · Resolution Capture"
            title="What was the actual issue?"
            whatItIs="A plain-English summary of what the customer was really asking or experiencing — not the ticket subject line, the underlying thing."
            why="The symptom a customer reports and the problem they actually have are often different. Recording the actual issue, in the agent's own words, is what lets the next agent recognize the same situation when it wears a different symptom. Skipped, this becomes tribal knowledge that leaves when the agent does."
            how="Write the real problem, one or two sentences. 'Thought they were double-charged; it was a pending auth that dropped off in two days' beats 'billing question.'"
            principle="The issue as reported and the issue as understood are rarely the same sentence."
          >
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
              What was the actual issue?
            </label>
            <textarea
              value={issueSummary}
              onChange={(e) => setIssueSummary(e.target.value)}
              rows={2}
              placeholder="Plain English. What were they actually asking or experiencing?"
              className="w-full bg-surface border border-default rounded-md px-2.5 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed"
            />
          </div>
          </LearningHint>
          <LearningHint
            as="block"
            category="C.A.R.E · Resolution Capture"
            title="What worked?"
            whatItIs="The specific thing the agent did or said that resolved it — concrete enough that a different agent could repeat it."
            why="A closed ticket that only records that it was resolved teaches nobody. Recording what worked turns this one resolution into a head start on the next similar one — it's the raw material the Read Phase surfaces to the next agent before they draft."
            how="Be specific and repeatable. 'Sent the refund link and explained pending auths drop in 48h' is reusable; 'fixed it' is not."
            principle="'Resolved' is a status. 'Here's what worked' is an asset."
          >
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
              What worked?
            </label>
            <textarea
              value={whatWorked}
              onChange={(e) => setWhatWorked(e.target.value)}
              rows={3}
              placeholder="What did you do or say that resolved it? Specific enough that the next agent could replicate it."
              className="w-full bg-surface border border-default rounded-md px-2.5 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed"
            />
          </div>
          </LearningHint>
          <LearningHint
            as="block"
            category="C.A.R.E · Resolution Capture"
            title="Category (optional)"
            whatItIs="A short, consistent tag for this kind of issue — a phrase like 'billing — refund applied,' not a formal taxonomy."
            why="One tagged resolution is a note. A dozen with the same tag in a week is a pattern worth investigating — a recurring issue the product or docs could remove at the source. The category is what lets the count surface itself instead of waiting for someone to notice."
            how="Reuse the same short phrase for the same kind of issue so the counts add up. Leave it blank if nothing fits rather than inventing a one-off."
            principle="Patterns only surface when the same thing gets named the same way twice."
          >
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
              Category <span className="text-muted normal-case">(optional · short phrase)</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. billing — refund applied"
              className="w-full bg-surface border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
            />
            <p className="text-[10px] text-muted mt-1 leading-relaxed">
              Categories surface patterns. 12 of these in a week becomes
              a signal worth investigating — without anyone having to
              ask.
            </p>
          </div>
          </LearningHint>

          {error && (
            <div className="bg-red-500/5 border border-red-500/30 rounded-md p-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-default flex items-center justify-between gap-2 bg-white/[0.02]">
          <p className="text-[10px] text-muted italic">
            Append-only — once captured, this becomes part of the company&apos;s
            playbook.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs text-muted hover:text-primary px-3 py-1.5 rounded-md"
            >
              Skip
            </button>
            <LearningHint
              category="C.A.R.E · Resolution Capture"
              title="Capture & resolve"
              whatItIs="Saves this resolution to the company's playbook and marks the conversation resolved in one step. The capture is append-only — it becomes part of the record, not an editable draft."
              why="Capture is bundled with resolving because the moment right after solving is the only time the details are still fresh and free. Make it a separate later chore and it never happens. Both fields need a few real words before this enables — a guard against blank rows that would dilute the playbook."
              how="Fill both fields, then click. Prefer 'Skip' over inventing filler if you genuinely have nothing worth recording — a noisy playbook is worse than a short one."
              principle="The knowledge is cheapest to capture in the sixty seconds after you solve it, and gone soon after."
            >
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={!canSubmit || submitting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 hover:border-emerald-500/70 text-emerald-300 disabled:opacity-40 px-3 py-1.5 rounded-md"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
              )}
              Capture & resolve
            </button>
            </LearningHint>
          </div>
        </div>
      </div>
    </div>
  );
}
