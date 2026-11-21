import { describe, it, expect } from 'vitest';
import { costOf, type Price } from '../cost';

/** Ported from the RSS scaffold's tests/rules.test.ts (docs/rss/scaffold/tests), Phase 0 step 6. */

describe('AI cost ledger (F28.7)', () => {
  const at = new Date('2026-11-13');
  const prices: Price[] = [
    { provider: 'p', model: 'm', unit: 'input_token', usdPerUnit: 0.000001, effectiveFrom: new Date('2026-01-01') },
    { provider: 'p', model: 'm', unit: 'output_token', usdPerUnit: 0.000002, effectiveFrom: new Date('2026-01-01') },
  ];
  it('costs a call from entered prices', () => {
    const r = costOf({ provider: 'p', model: 'm', inputTokens: 1000, outputTokens: 500, audioSeconds: 0, at }, prices);
    expect('usd' in r && r.usd).toBeCloseTo(0.002, 9);
  });
  it('reports a missing price instead of pretending it is zero', () => {
    expect(costOf({ provider: 'p', model: 'm', inputTokens: 1, outputTokens: 0, audioSeconds: 60, at }, prices)).toEqual({ missing: ['audio_second'] });
  });
});
