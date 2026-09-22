import { describe, it, expect } from "vitest";
import { bucketPeaks, PEAK_BUCKETS } from "../peaks";

/**
 * The bar strip a manager scrubs by.
 *
 * It is drawn from the real file or not at all, so what matters here is that the reduction does
 * not invent shape: a silent recording must not render as noise, a quiet one must still be
 * readable, and a short loud moment must survive the bucketing that a mean would erase.
 */

const of = (...v: number[]) => Float32Array.from(v);

describe("bucketing", () => {
  it("returns one value per bucket", () => {
    expect(bucketPeaks(of(...new Array(1000).fill(0.5)), 20)).toHaveLength(20);
  });

  it("defaults to the strip's width", () => {
    expect(bucketPeaks(of(...new Array(5000).fill(0.5)))).toHaveLength(PEAK_BUCKETS);
  });

  it("keeps a short loud moment instead of averaging it away", () => {
    // 1 loud sample in 100. A mean would render 0.01 — indistinguishable from silence — and the
    // strip exists to show exactly this kind of moment.
    const samples = new Array(100).fill(0.01);
    samples[50] = 1;
    expect(bucketPeaks(of(...samples), 1)[0]).toBe(1);
  });

  it("takes the magnitude, so a negative trough is as loud as a positive crest", () => {
    expect(bucketPeaks(of(-0.8, 0.2), 1)[0]).toBe(1); // normalised: -0.8 is the loudest
  });
});

describe("normalisation", () => {
  it("scales to the loudest bucket, so a quiet recording is still readable", () => {
    const p = bucketPeaks(of(0.1, 0.1, 0.05, 0.05), 2);
    expect(p).toEqual([1, 0.5]);
  });

  it("renders silence as silence, not as a full bar", () => {
    // Dividing by a zero loudest is the bug: every bucket becomes NaN or 1, and a recording with
    // no audio in it draws as constant noise.
    expect(bucketPeaks(of(0, 0, 0, 0), 2)).toEqual([0, 0]);
  });
});

describe("degenerate input", () => {
  it("returns nothing for an empty buffer rather than NaNs", () => {
    expect(bucketPeaks(of(), 10)).toEqual([]);
  });

  it("returns nothing when asked for no buckets", () => {
    expect(bucketPeaks(of(1, 2, 3), 0)).toEqual([]);
  });

  it("does not produce NaN when there are fewer samples than buckets", () => {
    const p = bucketPeaks(of(1, 0.5), 8);
    expect(p).toHaveLength(8);
    expect(p.every((v) => Number.isFinite(v))).toBe(true);
  });
});
