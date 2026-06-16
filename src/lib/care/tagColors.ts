/**
 * Care tag color palette. Matches the check constraint in 0035 —
 * if you add a new color here, update the migration's CHECK list.
 */

export type CareTagColor =
  | "gray"
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "violet"
  | "pink"
  | "arc";

export type CareTagTone = {
  chip: string;
  dot: string;
};

const TONES: Record<CareTagColor, CareTagTone> = {
  gray: { chip: "bg-surface border-default text-secondary", dot: "bg-muted" },
  blue: { chip: "bg-blue-500/10 border-blue-500/40 text-blue-300", dot: "bg-blue-400" },
  emerald: { chip: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300", dot: "bg-emerald-400" },
  amber: { chip: "bg-amber-500/10 border-amber-500/40 text-amber-300", dot: "bg-amber-400" },
  red: { chip: "bg-red-500/10 border-red-500/40 text-red-300", dot: "bg-red-400" },
  violet: { chip: "bg-violet-500/10 border-violet-500/40 text-violet-300", dot: "bg-violet-400" },
  pink: { chip: "bg-pink-500/10 border-pink-500/40 text-pink-300", dot: "bg-pink-400" },
  arc: { chip: "bg-arc-400/10 border-arc-400/40 text-arc-300", dot: "bg-arc-300" },
};

export function tagTone(color: string): CareTagTone {
  return TONES[color as CareTagColor] ?? TONES.gray;
}

export const ALL_TAG_COLORS: CareTagColor[] = [
  "gray",
  "blue",
  "emerald",
  "amber",
  "red",
  "violet",
  "pink",
  "arc",
];

// ─── Priority display ──────────────────────────────────────────

export type CarePriority = "urgent" | "high" | "normal" | "low";

export type PriorityDisplay = {
  label: string;
  short: string; // 1-2 char glyph for tight inbox rows
  tone: { chip: string; dot: string };
  weight: number; // for sorting
};

const PRIORITY_DISPLAY: Record<CarePriority, PriorityDisplay> = {
  urgent: {
    label: "Urgent",
    short: "U",
    tone: { chip: "bg-red-500/15 border-red-500/50 text-red-300", dot: "bg-red-500" },
    weight: 3,
  },
  high: {
    label: "High",
    short: "H",
    tone: { chip: "bg-amber-500/15 border-amber-500/50 text-amber-300", dot: "bg-amber-500" },
    weight: 2,
  },
  normal: {
    label: "Normal",
    short: "N",
    tone: { chip: "bg-surface border-default text-secondary", dot: "bg-muted" },
    weight: 1,
  },
  low: {
    label: "Low",
    short: "L",
    tone: { chip: "bg-surface border-default text-muted", dot: "bg-secondary" },
    weight: 0,
  },
};

export function priorityDisplay(priority: string): PriorityDisplay {
  return PRIORITY_DISPLAY[priority as CarePriority] ?? PRIORITY_DISPLAY.normal;
}

export const ALL_PRIORITIES: CarePriority[] = ["urgent", "high", "normal", "low"];
