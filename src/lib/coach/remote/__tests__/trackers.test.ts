import { describe, it, expect } from 'vitest';
import { matchTracker, normalisePhrases, TrackerError } from '../trackers';

/** Ported from the RSS scaffold's tests/rules.test.ts (docs/rss/scaffold/tests), Phase 3 step 3. */

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

describe('keyword trackers — repo additions', () => {
  it('a segment with no wall clock is still a hit, with no time to play from', () => {
    expect(matchTracker({ id: 't', name: 'C', phrases: ['spectrum'], side: 'any' }, [{ speaker: 'customer', startMs: null, text: 'Spectrum', seq: 4 }]))
      .toEqual([{ trackerId: 't', atMs: null, speaker: 'customer', matched: 'spectrum', seq: 4 }]);
  });
  it('refuses a phrase under two characters and more than 200 phrases', () => {
    expect(() => normalisePhrases(['a'])).toThrow(/too short/);
    expect(() => normalisePhrases(Array.from({ length: 201 }, (_, i) => `p${i}`))).toThrow(/200/);
  });
});

describe("partial-call window (0335, F11.3)", () => {
  const T = { id: "t", name: "Disclosure", phrases: ["recorded line"], side: "rep" as const, within_first_seconds: 120 };
  const seg = (startMs: number | null) => ({ speaker: "rep" as const, startMs, text: "this is a recorded line", seq: 1 });
  it("counts a line inside the window, not one after it", () => {
    expect(matchTracker(T, [seg(90_000)])).toHaveLength(1);
    expect(matchTracker(T, [seg(121_000)])).toHaveLength(0);
  });
  it("a line with no time can't be placed in the window — left out; with no window it counts", () => {
    expect(matchTracker(T, [seg(null)])).toHaveLength(0);
    expect(matchTracker({ ...T, within_first_seconds: null }, [seg(null)])).toHaveLength(1);
  });
});
