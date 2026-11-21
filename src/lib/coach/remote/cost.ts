/**
 * F28.7 - AI cost ledger. One row per model call, written at the llmCall/llmStream chokepoint
 * [OBSERVED deepseek.ts:232 returns promptTokens/completionTokens; nothing saves them].
 * Prices are NOT in code: an ELOSTATE admin enters them in ai_prices. A missing price shows as
 * missing, never as zero.
 */
export type Unit = 'input_token' | 'output_token' | 'audio_second';
export interface UsageRow { provider: string; model: string; inputTokens: number; outputTokens: number; audioSeconds: number; at: Date }
export interface Price { provider: string; model: string; unit: Unit; usdPerUnit: number; effectiveFrom: Date }

export function priceFor(prices: Price[], provider: string, model: string, unit: Unit, at: Date): Price | null {
  const c = prices
    .filter((p) => p.provider === provider && p.model === model && p.unit === unit && p.effectiveFrom <= at)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return c[0] ?? null;
}

export function costOf(row: UsageRow, prices: Price[]): { usd: number } | { missing: Unit[] } {
  const parts: [Unit, number][] = [['input_token', row.inputTokens], ['output_token', row.outputTokens], ['audio_second', row.audioSeconds]];
  const missing: Unit[] = [];
  let usd = 0;
  for (const [unit, qty] of parts) {
    if (qty === 0) continue;
    if (qty < 0 || !Number.isFinite(qty)) throw new Error(`Bad quantity for ${unit}`);
    const p = priceFor(prices, row.provider, row.model, unit, row.at);
    if (!p) missing.push(unit);
    else usd += qty * p.usdPerUnit;
  }
  return missing.length ? { missing } : { usd };
}
