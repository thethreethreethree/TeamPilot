"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useExperienceMode } from "./ExperienceModeProvider";

/**
 * Progressive-disclosure primitive for Experience Mode (0110, Phase 3).
 *
 * - Expert: renders `children` directly, exactly as today (no wrapper chrome).
 * - Standard: collapses `children` behind a one-click "show more" reveal. This is
 *   the §3.3/§3.4 guarantee made structural — Standard shows LESS at once but
 *   NEVER hides: the full detail is always one click away, never removed. The
 *   founder's confirmed drill-in (2026-07-09).
 *
 * Use it to wrap advanced/secondary panels a Standard user doesn't need up front
 * (deep reasoning, methodology, secondary metrics) — NOT primary content or
 * anything unsafe to defer. Before `loaded`, treats mode as Standard (collapsed)
 * to avoid a flash of the full detail that then collapses.
 */
export function AdvancedDetail({
  label = "Show more detail",
  children,
  className,
}: {
  /** The reveal button text in Standard mode. Name what's inside, e.g.
   *  "Show the full reasoning", "Show all metrics". */
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isExpert } = useExperienceMode();
  const [open, setOpen] = useState(false);

  // Expert (or an already-expanded Standard user) sees the full content inline.
  if (isExpert) return <>{children}</>;

  if (open) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-primary"
          aria-expanded={true}
        >
          <ChevronDown className="h-3 w-3" aria-hidden /> Show less
        </button>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-primary ${className ?? ""}`}
      aria-expanded={false}
    >
      <ChevronRight className="h-3 w-3" aria-hidden /> {label}
    </button>
  );
}
