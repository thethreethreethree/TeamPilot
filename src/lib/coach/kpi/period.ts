/**
 * KPI period (2026-11-25; Gong ledger F23.8; founder picker "Outcome numbers only"). The period switch changes ONLY the
 * outcome numbers below — computed over sessions started in the last N days. Every other number keeps its own window
 * (quota = this month; progression = first vs latest; the rest all time) and the page labels it so. One list, read by
 * the route that filters and the page that labels (§2.2). Pure.
 */
export const PERIOD_DAYS = [30, 90] as const;
export type PeriodDays = (typeof PERIOD_DAYS)[number] | null; // null = all time

export const PERIOD_METRICS = ["conversionRate", "closeRate", "winLossRatio", "revenue", "avgDealSize", "sessionsPerDay", "avgSessionDurationMin"] as const;

export function parsePeriod(v: string | null): PeriodDays {
  const n = Number(v);
  return (PERIOD_DAYS as readonly number[]).includes(n) ? (n as PeriodDays) : null;
}

/** Sessions started within the period (all of them for all time). */
export function inPeriod<T extends { startedAt: string }>(rows: T[], days: PeriodDays, nowMs = Date.now()): T[] {
  if (days === null) return rows;
  const since = nowMs - days * 86_400_000;
  return rows.filter((r) => Date.parse(r.startedAt) >= since);
}
