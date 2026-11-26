import { describe, it, expect } from 'vitest';
import { matchTracker, normalisePhrases, trackerAppliesTo, TrackerError } from '../trackers';

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

describe("trackerAppliesTo (0344, F11.5)", () => {
  it("no dates: every call; dated: from the start of the start day through the end of the end day (UTC)", async () => {
    const { trackerAppliesTo } = await import("../trackers");
    expect(trackerAppliesTo({}, null)).toBe(true);
    const t = { starts_on: "2026-12-01", ends_on: "2026-12-31" };
    expect(trackerAppliesTo(t, "2026-11-30T23:59:59Z")).toBe(false);
    expect(trackerAppliesTo(t, "2026-12-01T00:00:00Z")).toBe(true);
    expect(trackerAppliesTo(t, "2026-12-31T23:59:59Z")).toBe(true);
    expect(trackerAppliesTo(t, "2027-01-01T00:00:00Z")).toBe(false);
    expect(trackerAppliesTo({ starts_on: "2026-12-01" }, "2027-06-01T00:00:00Z")).toBe(true);
    expect(trackerAppliesTo({ ends_on: "2026-12-01" }, "2026-01-01T00:00:00Z")).toBe(true);
  });
  it("a dated tracker leaves out a call with no known start", async () => {
    const { trackerAppliesTo } = await import("../trackers");
    expect(trackerAppliesTo({ starts_on: "2026-12-01" }, null)).toBe(false);
    expect(trackerAppliesTo({ ends_on: "2026-12-01" }, "not a date")).toBe(false);
  });
});

describe('trackerAppliesTo — call types (0361)', () => {
  it('a tracker limited to a call type counts only on it; no limit counts on both; an unknown type is left out', () => {
    expect(trackerAppliesTo({ channels: ['video'] }, '2026-11-20T00:00:00Z', 'video')).toBe(true);
    expect(trackerAppliesTo({ channels: ['video'] }, '2026-11-20T00:00:00Z', 'phone')).toBe(false);
    expect(trackerAppliesTo({ channels: ['video'] }, '2026-11-20T00:00:00Z', null)).toBe(false);
    expect(trackerAppliesTo({ channels: null }, '2026-11-20T00:00:00Z', 'phone')).toBe(true);
    expect(trackerAppliesTo({ channels: ['phone'], starts_on: '2026-12-01' }, '2026-11-20T00:00:00Z', 'phone')).toBe(false); // dates still apply
  });
});

