import { describe, it, expect } from 'vitest';
import { transition, closeWithOutcome, canTransition, scoringDecision, TransitionError } from '../session/state';

describe('remote session lifecycle', () => {
  it('allows the normal path live -> awaiting_outcome -> close -> processing -> scored', () => {
    let s = transition('live', 'awaiting_outcome', 'rep');
    s = closeWithOutcome(s, 'follow_up', 'rep').state;
    s = transition(s, 'analyzing', 'system');
    s = transition(s, 'scoring', 'system');
    expect(transition(s, 'scored', 'system')).toBe('scored');
  });
  it('refuses closing without an outcome (F25.9)', () => {
    expect(() => closeWithOutcome('awaiting_outcome', null, 'rep')).toThrow(TransitionError);
    expect(() => closeWithOutcome('awaiting_outcome', 'maybe', 'rep')).toThrow(/needs an outcome/);
  });
  it('refuses skipping the outcome step via a raw transition', () => {
    expect(() => transition('awaiting_outcome', 'transcribing', 'rep')).toThrow(/closeWithOutcome/);
  });
  it('refuses anyone but the rep picking the outcome', () => {
    expect(() => closeWithOutcome('awaiting_outcome', 'sold', 'manager')).toThrow(/rep who ran/);
  });
  it('lets a manager re-score a scored session', () => {
    expect(canTransition('scored', 'scoring', 'manager')).toBe(true);
  });
  it('refuses a rep re-scoring (F15.15)', () => {
    expect(canTransition('scored', 'scoring', 'rep')).toBe(false);
    expect(() => transition('scored', 'scoring', 'rep')).toThrow(TransitionError);
  });
  it('allows a system retry from failed, refuses a rep retry', () => {
    expect(canTransition('failed', 'transcribing', 'system')).toBe(true);
    expect(canTransition('failed', 'transcribing', 'rep')).toBe(false);
  });
  it('scores at today\'s floor (one rep segment) and refuses below it', () => {
    expect(scoringDecision(1, true)).toEqual({ score: true });
    expect(scoringDecision(0, true)).toEqual({ score: false, reason: 'BELOW_SCORING_FLOOR' });
    expect(scoringDecision(9, false)).toEqual({ score: false, reason: 'NOT_A_SALES_CALL' });
  });
});
