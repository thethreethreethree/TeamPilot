/**
 * Care status display labels — §A18 invitation language applied to
 * the support inbox. The DB stores the canonical workflow value
 * ("open", "in_conversation", etc.); the agent reads what they
 * should DO next, not what state the row is technically in.
 *
 * Standard support tools call these "Open / Pending / On Hold /
 * Solved / Closed" — descriptive but verdict-shaped. Our labels
 * invite the agent's next move instead.
 */

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Clock,
  CornerDownLeft,
  Inbox,
  XCircle,
} from "lucide-react";

export type CareConversationStatus =
  | "open"
  | "in_conversation"
  | "awaiting_customer"
  | "resolved"
  | "closed";

export type CareStatusDisplay = {
  /** What the agent reads. Invitation-shaped. */
  label: string;
  /** One-line subtitle for tooltips. */
  invites: string;
  icon: LucideIcon;
  tone: { border: string; bg: string; text: string };
};

const TONES = {
  new: {
    border: "border-[#FACC15]/40",
    bg: "bg-[#FACC15]/10",
    text: "text-brand",
  },
  active: {
    border: "border-arc-400/40",
    bg: "bg-arc-400/10",
    text: "text-arc-300",
  },
  waiting: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
  },
  resolved: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
  },
  closed: {
    border: "border-default",
    bg: "bg-surface",
    text: "text-muted",
  },
};

const DISPLAY: Record<CareConversationStatus, CareStatusDisplay> = {
  open: {
    label: "Needs first response",
    invites: "Customer is waiting to hear from someone.",
    icon: Inbox,
    tone: TONES.new,
  },
  in_conversation: {
    label: "In conversation",
    invites: "An agent is actively replying.",
    icon: CornerDownLeft,
    tone: TONES.active,
  },
  awaiting_customer: {
    label: "Awaiting customer",
    invites: "We replied; ball is in the customer's court.",
    icon: Clock,
    tone: TONES.waiting,
  },
  resolved: {
    label: "Resolved",
    invites: "Outcome recorded. Reopens automatically if the customer replies.",
    icon: CheckCircle2,
    tone: TONES.resolved,
  },
  closed: {
    label: "Closed",
    invites: "Archived. No further activity expected.",
    icon: XCircle,
    tone: TONES.closed,
  },
};

export function careStatusDisplay(
  status: string
): CareStatusDisplay {
  return DISPLAY[status as CareConversationStatus] ?? DISPLAY.open;
}
