import type { ChatMessage } from "@/lib/data/chats";

/**
 * Shared helpers for the chat detail surface — extracted from
 * the chat detail page during the §1.7 audit's B2 refactor (1334-LOC
 * page split into focused files).
 */

/** Locale-aware short time, e.g. "12:22 PM". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Today" / "Yesterday" / e.g. "Tuesday, Jun 3" — used in the day separator. */
export function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export interface MessageGroup {
  dateKey: string;
  label: string;
  messages: ChatMessage[];
}

/** Group a flat message stream by date (UTC-day boundary). */
export function groupMessages(msgs: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of msgs) {
    const dateKey = m.createdAt.slice(0, 10);
    let g = groups[groups.length - 1];
    if (!g || g.dateKey !== dateKey) {
      g = { dateKey, label: formatDateHeader(m.createdAt), messages: [] };
      groups.push(g);
    }
    g.messages.push(m);
  }
  return groups;
}

/** Status badge classes for chat topic statuses. */
export const STATUS_BADGE: Record<string, string> = {
  open: "bg-surface-raised text-active-text border border-[#FACC15]/30",
  closed: "bg-gold-400/15 text-accent-text border border-gold-400/40",
  archived: "bg-surface-raised text-muted border border-default",
};
