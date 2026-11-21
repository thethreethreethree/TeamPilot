import { describe, it, expect } from 'vitest';
import { resolveScoreRequest, RescoreRefused, RESCORE_CHANGES_POINTS } from '../src/lib/coach/remote/rescore';
import { lockoutState, evaluate } from '../src/lib/coach/remote/lockout';
import { GONG_LOCKOUT_REFERENCE, NotDecidedError } from '../src/lib/coach/remote/decisions';
import { matchTracker, normalisePhrases, TrackerError } from '../src/lib/coach/remote/trackers';
import { gongRules, countsAsFeedback, isRequestOpen, listenedSeconds, counted, type CoachingEvent } from '../src/lib/coach/remote/feedback';
import { validateSnippet, canPlaySnippet, SnippetError } from '../src/lib/coach/remote/snippets';
import { maskDigitRuns, applyRedaction } from '../src/lib/coach/remote/redaction';
import { sign, verify, assertEndpointUrl } from '../src/lib/coach/remote/webhooks';
import { costOf, type Price } from '../src/lib/coach/remote/cost';
import { rubricFor, rescaleSection } from '../src/lib/coach/remote/rubric';

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

describe('keyword trackers (F11.1)', () => {
  const segs = [
    { speaker: 'customer' as const, startMs: 0, endMs: 5000, text: 'We are with Spectrum right now' },
    { speaker: 'rep' as const, startMs: 5000, endMs: 9000, text: 'Spectrumless plans are not a thing' },
  ];
  it('matches whole words on the chosen side', () => {
    expect(matchTracker({ id: 't', name: 'Competitors', phrases: ['spectrum'], side: 'customer' }, segs)).toEqual([{ trackerId: 't', atMs: 0, speaker: 'customer', matched: 'spectrum' }]);
  });
  it('refuses partial words and the other side', () => {
    expect(matchTracker({ id: 't', name: 'C', phrases: ['spectrum'], side: 'rep' }, segs)).toEqual([]);
  });
  it('refuses an empty phrase list', () => {
    expect(() => normalisePhrases(['  ', ''])).toThrow(TrackerError);
  });
});

describe('feedback (F16.x, D8)', () => {
  const at = new Date('2026-11-13T10:00:00Z');
  const sent: CoachingEvent = { kind: 'comment_sent_to_rep', managerId: 'm1', repId: 'r1', at, sessionId: 's1' };
  const ai: CoachingEvent = { kind: 'ai_score', repId: 'r1', at, sessionId: 's1' };
  it('under Gong rules a sent comment counts and an AI score does not', () => {
    expect(gongRules(sent)).toBe(true);
    expect(gongRules(ai)).toBe(false);
  });
  it('refuses to count anything while D8 is undecided', () => {
    expect(() => countsAsFeedback(sent)).toThrow(NotDecidedError);
    expect(() => counted([[0, 1000]], 1000)).toThrow(NotDecidedError);
  });
  it('closes a request when the recipient acts on that session afterwards, not before', () => {
    const req = { sessionId: 's1', managerId: 'm1', createdAt: new Date('2026-11-13T09:00:00Z') };
    expect(isRequestOpen(req, [sent], gongRules)).toBe(false);
    const early = { ...sent, at: new Date('2026-11-13T08:00:00Z') };
    expect(isRequestOpen(req, [early], gongRules)).toBe(true);
  });
  it('merges overlapping listen ranges', () => {
    expect(listenedSeconds([[0, 10_000], [5_000, 15_000], [20_000, 21_000]])).toBe(16);
  });
});

describe('snippets (F9.13)', () => {
  it('accepts a snippet inside the recording', () => expect(() => validateSnippet(1000, 5000, 60_000)).not.toThrow());
  it('refuses one outside it or under a second', () => {
    expect(() => validateSnippet(59_000, 61_000, 60_000)).toThrow(SnippetError);
    expect(() => validateSnippet(1000, 1500, 60_000)).toThrow(SnippetError);
  });
  it('a peer plays it only from the company library and only once the rep granted it', () => {
    expect(canPlaySnippet({ viewerIsRep: false, viewerCanViewRep: false, inCompanyLibrary: true, share: 'granted' })).toBe(true);
    expect(canPlaySnippet({ viewerIsRep: false, viewerCanViewRep: false, inCompanyLibrary: true, share: 'revoked' })).toBe(false);
    expect(canPlaySnippet({ viewerIsRep: false, viewerCanViewRep: false, inCompanyLibrary: false, share: 'granted' })).toBe(false);
  });
});

describe('redaction (F33.3, D15)', () => {
  it('masks a long digit run, including one split by spaces', () => {
    expect(maskDigitRuns('card 4111 1111 1111 1111 ok', 12).text).toBe('card (REDACTED) ok');
  });
  it('leaves short numbers alone and stays off until decided', () => {
    expect(maskDigitRuns('call me at 5 pm, unit 12', 12).text).toBe('call me at 5 pm, unit 12');
    expect(applyRedaction('4111111111111111')).toBe('4111111111111111');
  });
});

describe('webhooks (F31.8)', () => {
  const body = '{"event":"session.scored"}';
  it('verifies a correct signature', () => {
    expect(verify('s3cret', 1000, body, sign('s3cret', 1000, body), 1010)).toBe(true);
  });
  it('refuses a wrong secret, a tampered body and an old timestamp', () => {
    expect(verify('s3cret', 1000, body, sign('other', 1000, body), 1010)).toBe(false);
    expect(verify('s3cret', 1000, body + ' ', sign('s3cret', 1000, body), 1010)).toBe(false);
    expect(verify('s3cret', 1000, body, sign('s3cret', 1000, body), 2000)).toBe(false);
  });
  it('accepts https endpoints and refuses http or local ones', () => {
    expect(() => assertEndpointUrl('https://client.example/hook')).not.toThrow();
    expect(() => assertEndpointUrl('http://client.example/hook')).toThrow();
    expect(() => assertEndpointUrl('https://localhost/hook')).toThrow();
  });
});

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
