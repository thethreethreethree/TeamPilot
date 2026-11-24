/**
 * Bell notices a person may turn off for themselves (0334; founder picker 2026-11-25 "Only FYI notices"). The same four
 * as the database CHECK — notices that only inform. Anything that asks someone to act is never mutable. Pure.
 */
export const MUTABLE_NOTIFICATION_TYPES = ["strong_session", "deal_closed", "call_ready", "call_scored"] as const;
export type MutableNotificationType = (typeof MUTABLE_NOTIFICATION_TYPES)[number];

export const MUTE_LABELS: Record<MutableNotificationType, string> = {
  strong_session: "A rep ran a strong session",
  deal_closed: "A rep closed a deal",
  call_ready: "Your uploaded call is ready",
  call_scored: "Your call is scored",
};

export function isMutableType(t: unknown): t is MutableNotificationType {
  return typeof t === "string" && (MUTABLE_NOTIFICATION_TYPES as readonly string[]).includes(t);
}

/** The types muted now: the latest row per type decides (rows in any order; higher id is later). */
export function currentlyMuted(rows: Array<{ id: number; type: string; muted: boolean }>): MutableNotificationType[] {
  const latest = new Map<string, { id: number; muted: boolean }>();
  for (const r of rows) {
    const had = latest.get(r.type);
    if (!had || r.id > had.id) latest.set(r.type, { id: r.id, muted: r.muted });
  }
  return MUTABLE_NOTIFICATION_TYPES.filter((t) => latest.get(t)?.muted === true);
}
