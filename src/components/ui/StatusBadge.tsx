import { cn } from "@/lib/utils";

// StatusType deliberately untyped — callers may pass any string; statusStyles
// below has a fallback for unknown values.

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Per TT.md A21 audit (2026-06-18) HIGH finding — until this fix, StatusBadge
 * used red-500 / blue-500 / yellow-500 / orange-500 (Tailwind defaults). Those
 * are not in the brand monopalette — red + blue were dropped 2026-06-12 when
 * the logo became design governance. The new tokens map status semantics
 * onto the ember scale + emerald:
 *
 *   - "danger/blocked/error" → ember-800 (burnt amber — semantic error per
 *     tokens.ts; reads as warning without the red-chroma palette violation)
 *   - "attention/warning"    → ember-500 (primary-hover amber)
 *   - "neutral/info"         → ember-300 (light amber — system speaking)
 *   - "validated/success"    → emerald-400 (one of two accepted accents)
 *   - "idle/no-state"        → surface-raised + secondary text
 *
 * The semantic loss vs the prior red/blue/yellow taxonomy is bounded: status
 * meaning is still distinguishable (3 ember intensities + emerald + neutral),
 * but the brand discipline holds. Color is one signal among several — labels
 * still read the status word.
 */
const statusStyles: Record<string, string> = {
  // Workflow / task statuses
  Blocked: "bg-ember-800/20 text-ember-300 border border-ember-800/40",
  "In Progress": "bg-ember-400/15 text-ember-300 border border-ember-400/30",
  "To Do": "bg-surface-raised text-secondary border border-strong",
  "Needs Review": "bg-ember-500/15 text-ember-300 border border-ember-500/30",
  Completed: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  // Priorities
  Critical: "bg-ember-800/20 text-ember-300 border border-ember-800/40",
  High: "bg-ember-500/15 text-ember-300 border border-ember-500/30",
  Medium: "bg-ember-400/15 text-ember-300 border border-ember-400/30",
  Low: "bg-surface-raised text-secondary border border-strong",
  // Workload state
  Overloaded: "bg-ember-800/20 text-ember-300 border border-ember-800/40",
  Balanced: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  Underutilized: "bg-ember-500/15 text-ember-300 border border-ember-500/30",
  // Invoice / payment
  Overdue: "bg-ember-800/20 text-ember-300 border border-ember-800/40",
  Pending: "bg-ember-500/15 text-ember-300 border border-ember-500/30",
  Paid: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  // Generic severities
  critical: "bg-ember-800/20 text-ember-300 border border-ember-800/40",
  warning: "bg-ember-500/15 text-ember-300 border border-ember-500/30",
  info: "bg-ember-400/15 text-ember-300 border border-ember-400/30",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        statusStyles[status] ?? "bg-surface-raised text-secondary border border-strong",
        className
      )}
    >
      {status}
    </span>
  );
}
