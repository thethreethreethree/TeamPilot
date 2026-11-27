/**
 * The API usage report (Engage plan E7; Gong F31.9): over the last 7 days, per key and route, how many requests came in
 * and how many were refused or failed (status 400 and up). Pure: the route reads api_usage (0378) and hands rows here.
 */
export const USAGE_DAYS = 7;
/** Rows read at most (newest first); past this the report says it covers only the newest ones. */
export const USAGE_MAX_ROWS = 50_000;

export type UsageRow = { key_id: string; route: string; status: number };
export type UsageLine = { keyId: string; route: string; requests: number; errors: number; limited: number };

/** Grouped by key, then route; busiest first. `limited` counts 429s, also in `errors`: the per-second limit (a request past the daily limit isn't recorded, 0378). */
export function summarizeUsage(rows: UsageRow[]): UsageLine[] {
  const by = new Map<string, UsageLine>();
  for (const r of rows) {
    const k = `${r.key_id}\u0000${r.route}`;
    const line = by.get(k) ?? { keyId: r.key_id, route: r.route, requests: 0, errors: 0, limited: 0 };
    line.requests += 1;
    if (r.status >= 400) line.errors += 1;
    if (r.status === 429) line.limited += 1;
    by.set(k, line);
  }
  return [...by.values()].sort((a, b) => a.keyId.localeCompare(b.keyId) || b.requests - a.requests || a.route.localeCompare(b.route));
}
