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

/**
 * The canonical task workflow statuses, in workflow order — the SINGLE source
 * of truth for the status VALUE set. The zod create/patch enum (validate.ts) and
 * the operations board's status dropdown both import this, so a status can't be
 * added in one place and silently missed in another (the drift that broke the
 * server transition guard — see TASK_STATUS_TRANSITIONS below).
 *
 * 'Cancelled' is intentionally absent — see TERMINAL_TASK_STATUSES for the split.
 */
export const TASK_CANONICAL_STATUSES = [
  "To Do",
  "In Progress",
  "Blocked",
  "Needs Review",
  "Completed",
] as const;

/** Canonical workflow status — derived from TASK_CANONICAL_STATUSES (single source). */
export type TaskCanonicalStatus = (typeof TASK_CANONICAL_STATUSES)[number];

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
    border: "border-ember-400/40",
    bg: "bg-ember-400/10",
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

/**
 * Terminal (closed) task statuses — no further work happens on one, so any
 * "is this task still open / does it need attention?" check must treat ALL of
 * these as closed.
 *
 * 'Completed' is canonical (above). 'Cancelled' is deliberately NOT in
 * TaskCanonicalStatus — the DISPLAY/label domain is the 5 workflow values — but
 * a task CAN nonetheless BE 'Cancelled': the server transition map
 * (src/app/api/tasks/route.ts) admits New/In Progress/Blocked → Cancelled, and
 * `tasks.status` is free `text` with no DB CHECK. A check that only excludes
 * 'Completed' therefore acts on deliberately-ended work — false `task_slipped`
 * signals (fixed in migration 0184), nudges on cancelled tasks, stale badges on
 * cancelled tasks. This constant is the single source of truth for "closed",
 * and is correct whether or not 'Cancelled' is ever promoted to a first-class
 * canonical status (labels/enum/UI) — an open founder decision (the source-of-
 * truth split: transition map admits it; label domain + create enum omit it).
 */
export const TERMINAL_TASK_STATUSES = ["Completed", "Cancelled"] as const;

/** True when a task is in a terminal/closed status (no further work expected). */
export function isTaskClosed(status: string | null | undefined): boolean {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status ?? "");
}

/**
 * The task status transition graph — the SINGLE source of truth for "given the
 * current status, which statuses may it move to?".
 *
 * Why this lives here (not copied into each caller): it was previously declared
 * TWICE — once in the operations detail page (client, the graph the UI renders)
 * and once inline in PATCH /api/tasks (server, "backend now enforces it"). The
 * two DRIFTED: the server copy keyed the start state as a phantom 'New' (the app
 * only ever writes 'To Do'), omitted 'To Do' and 'Needs Review' entirely (so the
 * server rejected the most basic transition — To Do → In Progress — for the API
 * consumers it was added to protect), and listed 'Cancelled' targets the UI never
 * offers. The comment claimed the server "mirrors the UI map" while it did not.
 * Making both import THIS constant makes that invariant structural, not a hope.
 *
 * Keys are canonical statuses (TaskCanonicalStatus). 'Cancelled' is intentionally
 * absent: the UI never offered it and it has no label/enum — so no app path
 * creates a cancelled task. isTaskClosed()/migration 0184 still handle 'Cancelled'
 * defensively (direct SQL, imports, a future deliberate re-add). Promoting
 * 'Cancelled' to a first-class transition is an open founder decision — it would
 * be a single edit here plus a label + create-enum value.
 */
export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  "To Do": ["In Progress", "Blocked"],
  "In Progress": ["Needs Review", "Blocked", "Completed"],
  Blocked: ["In Progress", "To Do"],
  "Needs Review": ["Completed", "In Progress"],
  Completed: [],
};

/** Statuses `status` may transition to. Unknown status → [] (no transitions). */
export function allowedTaskTransitions(status: string): string[] {
  return TASK_STATUS_TRANSITIONS[status] ?? [];
}

/**
 * Task priority levels, low → high — the SINGLE source of truth for the priority
 * VALUE set. Like TASK_CANONICAL_STATUSES: the zod enum (validate.ts) and the
 * operations board dropdown both import this so the list can't drift between
 * client and server. (This file is the client-safe home for task-domain value
 * sets; validate.ts is server-only and can't be imported by the board page.)
 */
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

/** Task priority — derived from TASK_PRIORITIES (single source). */
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
