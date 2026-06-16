"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2, X } from "lucide-react";

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
      <div className="bg-base border border-default rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
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
          </div>
        </div>
      </div>
    </div>
  );
}
