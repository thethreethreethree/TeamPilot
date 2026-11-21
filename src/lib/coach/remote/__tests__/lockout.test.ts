import { describe, it, expect } from 'vitest';
import { lockoutState, evaluate } from '../lockout';
import { GONG_LOCKOUT_REFERENCE, NotDecidedError } from '../decisions';

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
  it('refuses to run with no decided policy', () => {
    expect(() => evaluate([], now)).toThrow(NotDecidedError);
  });
});
