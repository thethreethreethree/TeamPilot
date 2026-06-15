/**
 * §A18 — Task status labels invite behavior, not describe state.
 *
 * The status column on `tasks` holds the canonical workflow value
 * ('To Do' | 'In Progress' | 'Blocked' | 'Needs Review' | 'Completed').
 * That value is what the chain records and the §3.5 readout reads.
 *
 * Display labels are different. §A18 says: when the System surfaces
 * status to a leader (or to the participant themselves), the LABEL
 * is doing structural work — it invites a specific next behavior.
 * "Blocked" reads as a verdict ("this person is stuck, why?"); the
 * same task labeled "Requesting Collaboration" invites partnership.
 * Same data, opposite emergent behavior.
 *
 * Per the user's choice (2026-06-15): "Requesting Collaboration"
 * specifically because "some people are too prideful to ask for
 * help — requesting collaboration calls for working together, not
 * just asking for help." That phrasing matters; preserve it.
 *
 * The mapping is one-way: chain status → display label. The chain
 * keeps its canonical value forever; the labels can evolve.
 */

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CircleDot,
  Handshake,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export type TaskCanonicalStatus =
  | "To Do"
  | "In Progress"
  | "Blocked"
  | "Needs Review"
  | "Completed";

export type TaskDisplayLabel = {
  /** The invitation the leader / participant reads. NOT the chain value. */
  label: string;
  /** One-line subtitle clarifying what this invites. Used in tooltips
   *  and on the status pill where there's room. */
  invites: string;
  icon: LucideIcon;
  /** Tailwind color tokens — uniform shape so a renderer can drop
   *  them into the same chip style across surfaces. */
  tone: {
    border: string;
    bg: string;
    text: string;
  };
};

const TONES = {
  neutral: {
    border: "border-default",
    bg: "bg-surface",
    text: "text-secondary",
  },
  momentum: {
    border: "border-[#FACC15]/40",
    bg: "bg-[#FACC15]/10",
    text: "text-brand",
  },
  collaboration: {
    border: "border-arc-400/40",
    bg: "bg-arc-400/10",
    text: "text-arc-300",
  },
  review: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
  },
  resolved: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
  },
};

/**
 * Canonical → display mapping.
 *
 *   To Do        → "Ready to start"        (invites starting, not "queued")
 *   In Progress  → "Steady momentum"       (invites encouragement; A18)
 *   Blocked      → "Requesting Collaboration" (user-chosen, 2026-06-15)
 *   Needs Review → "Working through this"  (invites looking together)
 *   Completed    → "Resolved"              (closes with weight; not "done")
 */
const DISPLAY_BY_CANONICAL: Record<TaskCanonicalStatus, TaskDisplayLabel> = {
  "To Do": {
    label: "Ready to start",
    invites: "the first concrete action is named; pick it up.",
    icon: CircleDot,
    tone: TONES.neutral,
  },
  "In Progress": {
    label: "Steady momentum",
    invites:
      "progress is landing — same A18 principle as Coach: encourage, don't grade.",
    icon: Sparkles,
    tone: TONES.momentum,
  },
  Blocked: {
    label: "Requesting Collaboration",
    invites:
      "this row wants someone to work alongside — not someone to chase.",
    icon: Handshake,
    tone: TONES.collaboration,
  },
  "Needs Review": {
    label: "Working through this",
    invites: "a look-together moment — read the work, render the verdict.",
    icon: HelpCircle,
    tone: TONES.review,
  },
  Completed: {
    label: "Resolved",
    invites: "outcome recorded; §3.5 readout reads from here.",
    icon: CheckCircle2,
    tone: TONES.resolved,
  },
};

/**
 * Resolve the display label for a canonical status. Unknown values
 * (legacy data, typos in old rows) fall back to the "To Do" shape so
 * the UI never crashes; the chain value remains intact regardless.
 */
export function taskDisplayLabel(
  status: string
): TaskDisplayLabel {
  return (
    DISPLAY_BY_CANONICAL[status as TaskCanonicalStatus] ??
    DISPLAY_BY_CANONICAL["To Do"]
  );
}

/** All canonical statuses in workflow order. */
export const TASK_CANONICAL_STATUSES: TaskCanonicalStatus[] = [
  "To Do",
  "In Progress",
  "Blocked",
  "Needs Review",
  "Completed",
];
