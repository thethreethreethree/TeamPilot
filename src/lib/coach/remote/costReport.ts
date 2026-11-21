/**
 * The vendor AI cost report (RSS Phase 0 step 6, Gong F28.7): ai_usage rows priced with ai_prices, grouped by
 * session, company and engine. PURE — the route reads, this decides, the page renders.
 *
 * MISSING IS NOT ZERO. costOf (cost.ts) returns `{ missing }` for a call whose price was never entered. A
 * group containing such a call has `usd: null` and lists what is missing, rather than a partial sum that would
 * read as the full cost. `pricedUsd` and `unpricedCalls` say exactly how much is known.
 */
import { costOf, type Price, type Unit, type UsageRow } from './cost';

export type LedgerRow = UsageRow & { companyId: string | null; sessionId: string | null; engine: string };

export type CostGroup = {
  key: string | null;
  companyId: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number;
  /** Null when any call in the group has no price for one of its units. */
  usd: number | null;
  missing: Unit[];
};

export type CostReport = {
  calls: number;
  pricedUsd: number;
  unpricedCalls: number;
  sessions: CostGroup[];
  companies: CostGroup[];
  engines: CostGroup[];
  missingPrices: Array<{ provider: string; model: string; unit: Unit }>;
};

type Acc = CostGroup & { pricedUsd: number };

function add(map: Map<string, Acc>, key: string | null, companyId: string | null, row: LedgerRow, cost: ReturnType<typeof costOf>) {
  const k = key ?? '\u0000none';
  const g =
    map.get(k) ??
    ({ key, companyId, calls: 0, inputTokens: 0, outputTokens: 0, audioSeconds: 0, usd: 0, missing: [], pricedUsd: 0 } as Acc);
  g.calls += 1;
  g.inputTokens += row.inputTokens;
  g.outputTokens += row.outputTokens;
  g.audioSeconds += row.audioSeconds;
  if ('usd' in cost) {
    g.pricedUsd += cost.usd;
  } else {
    for (const u of cost.missing) if (!g.missing.includes(u)) g.missing.push(u);
  }
  map.set(k, g);
}

const finish = (map: Map<string, Acc>): CostGroup[] =>
  [...map.values()]
    .map(({ pricedUsd, ...g }) => ({ ...g, usd: g.missing.length ? null : pricedUsd }))
    // Most expensive first; groups with a missing price first of all, because they need a price entered.
    .sort((a, b) => (a.usd === null ? -1 : b.usd === null ? 1 : b.usd - a.usd));

export function costReport(rows: readonly LedgerRow[], prices: readonly Price[]): CostReport {
  const sessions = new Map<string, Acc>();
  const companies = new Map<string, Acc>();
  const engines = new Map<string, Acc>();
  const missing = new Map<string, { provider: string; model: string; unit: Unit }>();
  let pricedUsd = 0;
  let unpricedCalls = 0;

  for (const row of rows) {
    const cost = costOf(row, [...prices]);
    if ('usd' in cost) pricedUsd += cost.usd;
    else {
      unpricedCalls += 1;
      for (const unit of cost.missing) missing.set(`${row.provider}\u0000${row.model}\u0000${unit}`, { provider: row.provider, model: row.model, unit });
    }
    if (row.sessionId) add(sessions, row.sessionId, row.companyId, row, cost);
    add(companies, row.companyId, row.companyId, row, cost);
    add(engines, row.engine, null, row, cost);
  }

  return {
    calls: rows.length,
    pricedUsd,
    unpricedCalls,
    sessions: finish(sessions),
    companies: finish(companies),
    engines: finish(engines),
    missingPrices: [...missing.values()],
  };
}
