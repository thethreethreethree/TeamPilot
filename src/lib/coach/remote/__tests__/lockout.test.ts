import { describe, it, expect } from 'vitest';
import { lockoutState, evaluate } from '../lockout';
import { GONG_LOCKOUT_REFERENCE } from '../decisions';

/** Ported from the RSS scaffold's tests/rules.test.ts (docs/rss/scaffold/tests), Phase 0 step 7. */

describe('lockout (F1.5, D4)', () => {
  const now = new Date('2026-11-13T10:00:00Z');
  const fail = (minAgo: number) => ({ email: 'a@b.c', succeeded: false, at: new Date(now.getTime() - minAgo * 60_000) });
  it('locks after the policy\'s failures inside the window', () => {
    const r = lockoutState([fail(5), fail(4), fail(3), fail(2), fail(1)], now, GONG_LOCKOUT_REFERENCE);
    expect(r.locked).toBe(true);
  });
  it('does not lock below the threshold, or after a success resets the count', () => {
    expect(lockoutState([fail(4), fail(3), fail(2), fail(1)], now, GONG_LOCKOUT_REFERENCE).locked).toBe(false);
    const ok = { email: 'a@b.c', succeeded: true, at: new Date(now.getTime() - 2.5 * 60_000) };
    expect(lockoutState([fail(5), fail(4), fail(3), ok, fail(2), fail(1)], now, GONG_LOCKOUT_REFERENCE).locked).toBe(false);
  });
  it('D4 decided (founder 2026-11-22): evaluate() locks at 5 failures in 60 minutes', () => {
    expect(evaluate([fail(5), fail(4), fail(3), fail(2), fail(1)], now).locked).toBe(true);
    expect(evaluate([fail(4), fail(3), fail(2), fail(1)], now).locked).toBe(false);
    expect(evaluate([fail(65), fail(64), fail(63), fail(62), fail(61)], now).locked).toBe(false); // outside the window
  });
});
