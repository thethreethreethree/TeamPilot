import { describe, it, expect } from "vitest";

/**
 * Detection separates a repeated miss from a bad day.
 *
 * The arithmetic is counting. What these tests pin is the three definitions the record settled
 * before any of this was written, each of which a reasonable implementation gets wrong:
 *
 *   C4  the strip is APPLICABLE-only and shorter than 10 is normal
 *   B4  a Partial is not a miss — but by a named parameter, not by a buried comparison
 *   §3.2 three in ten is the threshold below which a manager would be coaching noise
 */

import {
  detectPattern,
  cleanStreak,
  missedOnly,
  missedOrPartial,
  MISS_THRESHOLD,
  WINDOW,
  type GradedPitch,
} from "../detect";
import type { Grade } from "../../pitchScore/rubric";

/** Day n of 2026-03, so ordering is obvious in a failure message. */
const p = (day: number, grade: Grade, points = grade === "hit" ? 4 : grade === "partial" ? 2 : 0): GradedPitch => ({
  pitchId: `p${day}`,
  recordedAt: `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`,
  grade,
  points,
});

const run = (pitches: GradedPitch[], max = 4, isMiss = missedOnly) => detectPattern(pitches, max, isMiss);

describe("the threshold is the understanding gate", () => {
  it("opens nothing below the threshold", () => {
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "hit"), p(4, "hit")]);
    expect(v).toBeNull();
  });

  it("opens AT the threshold, not above it", () => {
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "missed")]);
    expect(v?.misses).toBe(MISS_THRESHOLD);
  });
});

describe("C4 — the strip is applicable-only", () => {
  it("is shorter than the window when the rep has fewer applicable pitches", () => {
    // The mockup's "5 of 7": seven dots because seven pitches applied, not ten with three blanks.
    const v = run([
      p(1, "missed"), p(2, "missed"), p(3, "missed"), p(4, "missed"), p(5, "missed"),
      p(6, "hit"), p(7, "hit"),
    ]);
    expect(v).toMatchObject({ misses: 5, applicable: 7 });
    expect(v?.strip).toHaveLength(7);
  });

  it("never pads to the window, which is what would open a pattern on every new rep", () => {
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "missed")]);
    expect(v?.applicable).toBe(3);
    expect(v?.strip).toHaveLength(3);
  });

  it("caps at the window when there are more", () => {
    const many = Array.from({ length: 14 }, (_, i) => p(i + 1, i < 4 ? "missed" : "hit"));
    const v = run(many);
    // Newest 10 are days 5-14, all hits — the four misses are the OLDEST and fall outside.
    expect(v).toBeNull();
    expect(run(many.slice(0, 4))?.applicable).toBe(4);
  });

  it("takes the NEWEST of the window, whatever order the caller passed", () => {
    const shuffled = [p(9, "hit"), p(1, "missed"), p(12, "missed"), p(3, "missed"), p(11, "missed")];
    const v = run(shuffled);
    expect(v?.strip[0]).toBe("missed"); // day 12, the newest
    expect(v?.applicable).toBe(5);
  });

  it("has nothing to say about a rep with no applicable pitches", () => {
    expect(run([])).toBeNull();
  });
});

describe("B4 — Partial is a parameter, not a decision", () => {
  const twoMissedThreePartial = [
    p(1, "missed"), p(2, "missed"), p(3, "partial"), p(4, "partial"), p(5, "partial"),
  ];

  it("does not count Partial by default", () => {
    expect(run(twoMissedThreePartial)).toBeNull();
  });

  it("counts it when the caller says so, and the count changes", () => {
    const v = run(twoMissedThreePartial, 4, missedOrPartial);
    expect(v?.misses).toBe(5);
  });

  it("the default IS missedOnly, so flipping the product is one argument", () => {
    expect(missedOnly("partial")).toBe(false);
    expect(missedOrPartial("partial")).toBe(true);
    expect(run(twoMissedThreePartial, 4)).toEqual(run(twoMissedThreePartial, 4, missedOnly));
  });
});

describe("cost is points LOST per applicable pitch", () => {
  it("averages over the strip, not over the misses", () => {
    // Three missed (4 lost each) and one hit (0 lost) = 12 over 4 pitches.
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "missed"), p(4, "hit")]);
    expect(v?.costPerPitch).toBe(3);
  });

  it("counts a Partial's half-credit as half a loss even when it is not a miss", () => {
    // A rep can be losing points steadily without the item ever counting as a pattern miss.
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "missed"), p(4, "partial", 2)]);
    expect(v?.costPerPitch).toBe(3.5); // 4+4+4+2 = 14 over 4
  });

  it("never reports a negative loss when a pitch scored above the element max", () => {
    // Defensive: an override can push points past the rubric max, and "you gained points by
    // missing it" is not a sentence a manager should ever be shown.
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "missed"), p(4, "hit", 99)]);
    expect(v?.costPerPitch).toBe(3);
  });

  it("rounds to one place", () => {
    const v = run([p(1, "missed"), p(2, "missed"), p(3, "missed"), p(4, "hit"), p(5, "hit"), p(6, "hit"), p(7, "hit")]);
    expect(v?.costPerPitch).toBe(1.7); // 12/7 = 1.714…
  });
});

describe("cleanStreak", () => {
  it("counts consecutive clean pitches from the NEWEST end", () => {
    expect(cleanStreak([p(1, "missed"), p(2, "hit"), p(3, "hit"), p(4, "hit")])).toBe(3);
  });

  it("is zero when the most recent applicable pitch missed", () => {
    expect(cleanStreak([p(1, "hit"), p(2, "hit"), p(3, "hit"), p(4, "missed")])).toBe(0);
  });

  it("stops at the first miss rather than counting all clean pitches", () => {
    expect(cleanStreak([p(1, "hit"), p(2, "missed"), p(3, "hit"), p(4, "hit")])).toBe(2);
  });

  it("uses the same predicate as detection, or a fix clears what detection re-opens", () => {
    const withPartial = [p(1, "missed"), p(2, "partial"), p(3, "hit")];
    expect(cleanStreak(withPartial, missedOnly)).toBe(2);
    expect(cleanStreak(withPartial, missedOrPartial)).toBe(1);
  });

  it("is zero for no applicable pitches, which is not the same as clean", () => {
    expect(cleanStreak([])).toBe(0);
  });
});

describe("the constants are named so they can be argued with", () => {
  it("three in ten", () => {
    expect(MISS_THRESHOLD).toBe(3);
    expect(WINDOW).toBe(10);
  });
});
