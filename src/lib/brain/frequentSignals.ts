/**
 * §4 evidence gate for the brain learning cycle (learn.ts). A signal KIND is only
 * surfaced as a "known pattern" to the brain once it has been observed at least
 * FREQUENT_SIGNAL_MIN times in the window — the System never claims a pattern
 * from thin evidence (§4: learning is gated by measured evidence, never by a
 * single or handful of occurrences). Pure + dependency-free so it is testable in
 * isolation (learn.ts is server-only with DB deps); learn.ts calls this on the
 * fetched signal rows.
 */
export const FREQUENT_SIGNAL_MIN = 5;
export const FREQUENT_SIGNAL_TOP_N = 10;

export function computeFrequentSignalKinds(
  rows: ReadonlyArray<{ kind: string }>
): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .filter((x) => x.count >= FREQUENT_SIGNAL_MIN)
    .sort((a, b) => b.count - a.count)
    .slice(0, FREQUENT_SIGNAL_TOP_N);
}
