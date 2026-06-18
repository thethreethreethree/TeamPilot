"use client";

import { useId, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLearningMode } from "./LearningModeProvider";

/**
 * Wrap any element with a Learning Mode hint.
 *
 * Per founder direction 2026-06-18: a hint is NOT a label. It is a
 * teaching artifact. ELOSTATE's company purpose is solving problems
 * + teaching users to think better; every Learning Mode entry must
 * carry that purpose. A hint that just says "this is the Ask Coach
 * button" is a §3.3 violation — it organizes the interface but
 * doesn't teach. The user closes the tooltip no smarter than they
 * opened it.
 *
 * Every hint surfaces four things:
 *
 *   - WHAT IT IS (`whatItIs`)
 *       The plain functional description — what the feature does
 *       when invoked. 1-2 sentences.
 *
 *   - WHY IT EXISTS (`why`)
 *       The problem it solves OR the constitutional discipline it
 *       embodies. Why is this here, what was the failure mode it
 *       was built to defeat. 2-3 sentences. THIS IS THE LOAD-
 *       BEARING SECTION. If you can't write it, the feature
 *       shouldn't exist.
 *
 *   - HOW TO USE IT (`how`)
 *       Operational guidance: when to reach for it, what to expect
 *       from its output, what NOT to do. 2-3 sentences.
 *
 *   - WHAT TO REMEMBER (`principle`, optional)
 *       The single transferable takeaway. A one-sentence rule the
 *       user can carry to similar features. Builds compounding
 *       knowledge — a user who reads 20 of these starts to see
 *       the discipline behind the surface.
 *
 * Per CLAUDE.md §3.3 — hints teach, never overtake. They explain
 * what the feature does and why. They never tell the user what to
 * click next.
 *
 * Usage:
 *
 *   <LearningHint
 *     category="C.A.R.E"
 *     title="Ask Coach"
 *     whatItIs="..."
 *     why="..."
 *     how="..."
 *     principle="..."
 *   >
 *     <button>Ask Coach</button>
 *   </LearningHint>
 */
export function LearningHint({
  title,
  whatItIs,
  why,
  how,
  principle,
  category,
  as = "inline-block",
  children,
}: {
  title: string;
  whatItIs: string;
  why: string;
  how: string;
  principle?: string;
  category?: string;
  as?: "inline-block" | "block";
  children: React.ReactNode;
}) {
  const { shouldRender, askJeff } = useLearningMode();
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!shouldRender) {
    return <>{children}</>;
  }

  const wrapperClass = `relative ${as === "block" ? "block" : "inline-block"} learning-hint-target`;

  return (
    <span
      className={wrapperClass}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => {
        // Tap-to-toggle on mobile. Don't preventDefault — we want
        // the underlying button/field to still respond.
        setOpen((p) => !p);
      }}
    >
      {/* Pulsing outline on the wrapped element so the user can
          SEE which elements are annotated when Learning Mode is on. */}
      <span
        aria-hidden
        className="absolute -inset-1 rounded-md border border-ember-400/60 animate-pulse pointer-events-none"
      />
      {children}
      {open && (
        <span
          role="tooltip"
          id={`learning-hint-${id}`}
          className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-ember-400/50 bg-base/95 backdrop-blur-sm shadow-glow-ember-soft px-4 py-3 text-left space-y-2.5"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Header: optional category badge + title */}
          <span className="block">
            {category && (
              <span className="block text-[9px] uppercase tracking-widest font-bold text-ember-300 mb-0.5">
                {category}
              </span>
            )}
            <span className="block text-sm font-semibold text-primary">
              {title}
            </span>
          </span>

          {/* What it is */}
          <span className="block">
            <span className="block text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">
              What it is
            </span>
            <span className="block text-[11px] text-secondary leading-relaxed">
              {whatItIs}
            </span>
          </span>

          {/* Why it exists (load-bearing) */}
          <span className="block">
            <span className="block text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">
              Why
            </span>
            <span className="block text-[11px] text-secondary leading-relaxed">
              {why}
            </span>
          </span>

          {/* How to use it */}
          <span className="block">
            <span className="block text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">
              How to use it
            </span>
            <span className="block text-[11px] text-secondary leading-relaxed">
              {how}
            </span>
          </span>

          {/* Optional transferable principle */}
          {principle && (
            <span className="block pt-1 border-t border-default">
              <span className="block text-[9px] uppercase tracking-widest font-bold text-ember-300 mb-0.5">
                What to remember
              </span>
              <span className="block text-[11px] text-primary leading-relaxed italic">
                {principle}
              </span>
            </span>
          )}

          {/* Ask Jeff — conversational follow-up. The structured
              entry covers the canonical teaching; Jeff handles
              questions the entry didn't anticipate. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              askJeff({
                title,
                whatItIs,
                why,
                how,
                principle,
                category,
              });
            }}
            className="w-full flex items-center justify-between gap-2 text-[11px] font-semibold text-ember-300 hover:text-primary border border-ember-400/40 hover:border-ember-400 bg-ember-400/5 hover:bg-ember-400/10 rounded-md px-2.5 py-1.5 transition-colors mt-1"
          >
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" aria-hidden />
              Ask Jeff what this does
            </span>
            <span className="text-muted">→</span>
          </button>
        </span>
      )}
    </span>
  );
}
