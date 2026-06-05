"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { ChatTopic, DurabilityReview } from "@/lib/data/chats";

/**
 * ReviewOutcomeModal — §3.5 durability review.
 *
 * The four-option vocabulary (held / partial / reopened / unknown) is
 * fixed by the schema. Each option carries its constitutional meaning
 * so the reviewer is choosing deliberately; the constitution forbids
 * inventing consequences (§3.4). Setting durability fires the
 * chat.topic_durability_reviewed event via migration 0015.
 *
 * Extracted from the chat detail page during the B2 refactor.
 */

const DURABILITY_OPTIONS: ReadonlyArray<{
  value: DurabilityReview;
  title: string;
  hint: string;
  positive: boolean;
}> = [
  {
    value: "held",
    title: "Held",
    hint: "The resolution stuck. The problem has not returned. This is the only outcome that counts as fully successful.",
    positive: true,
  },
  {
    value: "partial",
    title: "Partial",
    hint: "Something stuck but not everything. The team is partly better off; the underlying issue is partly still open.",
    positive: false,
  },
  {
    value: "reopened",
    title: "Reopened",
    hint: "The same problem came back. The closure was premature. The System should treat this as a recurrence signal.",
    positive: false,
  },
  {
    value: "unknown",
    title: "Not yet measurable",
    hint: "There isn't enough evidence yet to judge the outcome. No signal fires until a real outcome is recorded.",
    positive: false,
  },
];

export function ReviewOutcomeModal({
  topic,
  onClose,
  onReviewed,
}: {
  topic: ChatTopic;
  onClose: () => void;
  onReviewed: (durability: DurabilityReview) => void | Promise<void>;
}) {
  const current = topic.closeDurability as DurabilityReview | null;
  const [selected, setSelected] = useState<DurabilityReview | null>(current);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onReviewed(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Review outcome" size="xl">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          §3.5: closing a topic records the action. Reviewing the outcome
          records the <em>consequence</em>. The System uses your judgement
          here to derive a signal — held vs reopened is the only honest
          measure of whether a resolution actually worked.
          {current && current !== "unknown" && (
            <span className="block mt-1.5 text-accent-text/80">
              Current outcome: <strong>{current}</strong>. Pick a different
              option to change it. The prior judgement stays on the §3.1
              record.
            </span>
          )}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {DURABILITY_OPTIONS.map((opt) => {
            const isActive = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                disabled={submitting}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isActive
                    ? opt.positive
                      ? "border-gold-400/70 bg-gold-400/10"
                      : "border-arc-400/50 bg-arc-400/8"
                    : "border-default hover:border-strong bg-surface"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p
                    className={`text-sm font-semibold ${
                      isActive
                        ? opt.positive
                          ? "text-accent-text"
                          : "text-arc-300"
                        : "text-primary"
                    }`}
                  >
                    {opt.title}
                  </p>
                  {isActive && (
                    <span
                      className={`text-[10px] uppercase tracking-widest font-mono ${
                        opt.positive ? "text-accent-text" : "text-arc-300"
                      }`}
                    >
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-secondary leading-relaxed">
                  {opt.hint}
                </p>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-secondary italic">
            Each non-unknown choice fires a §3.5 consequence signal.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-xs text-muted hover:text-primary px-3 py-2 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={!selected || submitting || selected === current}
              className="flex items-center gap-2 bg-gold-400 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
            >
              {submitting ? (
                <>
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  Recording…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Record outcome
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
