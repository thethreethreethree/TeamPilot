import { describe, expect, it } from "vitest";
import {
  fillerStats,
  isFillerSpike,
  turnWpm,
  updatePaceBaseline,
  isPaceSpike,
  FILLER_SPIKE_DENSITY,
  PACE_MIN_SAMPLES,
  PACE_SPIKE_RATIO,
} from "../liveStress";

/**
 * Live-coaching stress-signal tests. These pure measures feed the cue brain —
 * a regression here mis-fires or misses the "steadying nudge" during a live
 * call, and "a late tip is worthless." Deterministic + verifiable (§3.5).
 */
describe("fillerStats", () => {
  it("returns zeros for empty / whitespace text", () => {
    expect(fillerStats("")).toEqual({ fillers: 0, words: 0, density: 0 });
    expect(fillerStats("   ")).toEqual({ fillers: 0, words: 0, density: 0 });
  });

  it("counts single-word fillers with density = fillers/words", () => {
    const s = fillerStats("um so the plan works"); // 5 words, 1 filler
    expect(s.fillers).toBe(1);
    expect(s.words).toBe(5);
    expect(s.density).toBeCloseTo(1 / 5);
  });

  it("counts CONSECUTIVE fillers separately (audit F3)", () => {
    expect(fillerStats("um um um").fillers).toBe(3);
  });

  it("matches multi-word fillers as one phrase", () => {
    expect(fillerStats("you know it works").fillers).toBe(1);
    expect(fillerStats("i mean, it is kind of ready").fillers).toBe(2); // "i mean" + "kind of"
  });

  it("respects word boundaries — does not match fillers inside words", () => {
    // "summit" contains "um", "likely" contains "like" — neither is a filler.
    expect(fillerStats("the summit is likely secure").fillers).toBe(0);
  });

  it("counts fillers adjacent to punctuation", () => {
    expect(fillerStats("well, um. like! it works").fillers).toBe(2); // um + like
  });
});

describe("isFillerSpike", () => {
  it("ignores short turns even at high filler density", () => {
    expect(isFillerSpike("um uh er")).toBe(false); // 3 words < FILLER_MIN_WORDS
  });

  it("flags a long turn whose density crosses the threshold", () => {
    // 10 words, 3 fillers => 0.30 density >= 0.18
    const text = "um so like the deal is you know basically ready";
    const { words, density } = fillerStats(text);
    expect(words).toBeGreaterThanOrEqual(8);
    expect(density).toBeGreaterThanOrEqual(FILLER_SPIKE_DENSITY);
    expect(isFillerSpike(text)).toBe(true);
  });

  it("does not flag a long, clean turn", () => {
    expect(
      isFillerSpike("the roof warranty covers material and labor for ten years")
    ).toBe(false);
  });
});

describe("turnWpm", () => {
  it("returns null for too-few words or too-short duration", () => {
    expect(turnWpm("only three words", 10)).toBeNull(); // < PACE_MIN_WORDS
    expect(turnWpm("one two three four five six seven", 0.2)).toBeNull(); // dur < 0.5
  });

  it("computes words per minute", () => {
    // 10 words in 30s => 10 / (30/60) = 20 wpm
    expect(turnWpm("one two three four five six seven eight nine ten", 30)).toBe(
      20
    );
  });
});

describe("updatePaceBaseline", () => {
  it("maintains a correct running mean", () => {
    let b = { mean: 0, count: 0 };
    b = updatePaceBaseline(b, 100);
    expect(b).toEqual({ mean: 100, count: 1 });
    b = updatePaceBaseline(b, 200);
    expect(b.count).toBe(2);
    expect(b.mean).toBeCloseTo(150);
    b = updatePaceBaseline(b, 300);
    expect(b.count).toBe(3);
    expect(b.mean).toBeCloseTo(200); // (100+200+300)/3
  });
});

describe("isPaceSpike", () => {
  it("stays quiet until the baseline is warmed up", () => {
    const cold = { mean: 100, count: PACE_MIN_SAMPLES - 1 };
    expect(isPaceSpike(1000, cold)).toBe(false); // not enough samples yet
  });

  it("does not fire on a zero baseline", () => {
    expect(isPaceSpike(1000, { mean: 0, count: 10 })).toBe(false);
  });

  it("fires when pace jumps past the ratio over a warm baseline", () => {
    const warm = { mean: 100, count: PACE_MIN_SAMPLES };
    expect(isPaceSpike(100 * PACE_SPIKE_RATIO, warm)).toBe(true); // exactly at ratio
    expect(isPaceSpike(100 * PACE_SPIKE_RATIO - 1, warm)).toBe(false); // just under
  });
});
