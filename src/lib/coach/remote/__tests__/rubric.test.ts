import { describe, it, expect } from 'vitest';
import { rubricFor, rescaleSection } from '../rubric';

/** Ported from the RSS scaffold's tests/rules.test.ts (docs/rss/scaffold/tests), Phase 3. */

describe('rubric per channel (F15.9, D6)', () => {
  const rows = [{ version: 'attfiber-v1', channel: 'any' as const, active: true }];
  it('uses an exact channel rubric with no caveat when one exists', () => {
    expect(rubricFor('phone', [...rows, { version: 'phone-v1', channel: 'phone', active: true }])).toEqual({ version: 'phone-v1', caveat: null });
  });
  it('falls back for remote calls but prints the caveat', () => {
    expect(rubricFor('video', rows).caveat).toMatch(/no video rubric yet/);
  });
  it('rescales a section when an element is N/A (F15.5)', () => {
    expect(rescaleSection([{ points: 8, na: true, earned: 0 }, { points: 27, na: false, earned: 27 }])).toBeCloseTo(35);
    expect(rescaleSection([{ points: 8, na: false, earned: 0 }, { points: 27, na: false, earned: 27 }])).toBeCloseTo(27);
  });
});
