import { describe, it, expect } from 'vitest';
import { resolveScoreRequest, RescoreRefused, RESCORE_CHANGES_POINTS } from '../rescore';

/** Ported from the RSS scaffold's tests/rules.test.ts (docs/rss/scaffold/tests), Phase 0 step 5. */

describe('re-score (F15.15)', () => {
  it('first score always runs with skipIfScored:true', () => {
    expect(resolveScoreRequest({ caller: { id: 'r1', isManagerOfRep: false }, repId: 'r1', alreadyScored: false })).toEqual({ skipIfScored: true, archiveFirst: false });
  });
  it('a manager can re-score with a reason, archiving the old version', () => {
    expect(resolveScoreRequest({ caller: { id: 'm1', isManagerOfRep: true }, repId: 'r1', alreadyScored: true, reason: 'audio fixed' })).toEqual({ skipIfScored: false, archiveFirst: true });
  });
  it('refuses the rep re-scoring their own session', () => {
    expect(() => resolveScoreRequest({ caller: { id: 'r1', isManagerOfRep: false }, repId: 'r1', alreadyScored: true, reason: 'try again' })).toThrow(RescoreRefused);
  });
  it('refuses a manager re-score without a reason, and a non-manager outright', () => {
    expect(() => resolveScoreRequest({ caller: { id: 'm1', isManagerOfRep: true }, repId: 'r1', alreadyScored: true })).toThrow(/reason/);
    expect(() => resolveScoreRequest({ caller: { id: 'r2', isManagerOfRep: false }, repId: 'r1', alreadyScored: true, reason: 'x y z' })).toThrow(/manager/);
  });
  it('never re-banks points', () => expect(RESCORE_CHANGES_POINTS).toBe(false));
});
