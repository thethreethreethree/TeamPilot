/**
 * Real peaks, or no peaks.
 *
 * The guide asks for "audio with a waveform". Every quick way to draw one — a seeded random bar
 * strip, a sine, a CSS gradient — draws a PICTURE OF AUDIO THAT IS NOT THIS AUDIO, positioned
 * under markers a manager clicks to jump to a specific second. It would look exactly like the
 * real thing and be a fabrication on the one screen in this product whose entire job is to let a
 * human check the machine (§3.3, A11). So the bars are decoded from the file or there are no bars.
 *
 * `decodeAudioData` needs the whole file and a CORS-readable response. Both can fail — a signed
 * URL that forbids cross-origin reads, a codec the browser will not decode, a recording too large
 * to hold in memory. Every one of those returns null, and the surface renders a plain seek track
 * with the markers still on it. A plain track is a smaller feature; a fake waveform is a lie.
 */

export type PeaksResult =
  | { status: "ok"; peaks: number[] }
  | { status: "unavailable"; reason: string };

/** How many bars the strip draws. Enough to read a pause, few enough to stay legible at tab width. */
export const PEAK_BUCKETS = 160;

/**
 * Reduce decoded samples to one normalised peak per bucket.
 *
 * MAX-ABS PER BUCKET, not RMS or mean. The strip is read for "where did someone stop talking",
 * and an average flattens a short loud moment into the noise floor around it. Normalised to the
 * loudest bucket so a quiet recording is still readable — the strip shows shape, not level.
 *
 * Pure and exported so it can be tested without an AudioContext, which jsdom does not have.
 */
export function bucketPeaks(samples: Float32Array, buckets = PEAK_BUCKETS): number[] {
  if (samples.length === 0 || buckets <= 0) return [];
  const size = samples.length / buckets;
  const out: number[] = [];
  let loudest = 0;

  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.min(samples.length, Math.floor((b + 1) * size));
    let peak = 0;
    for (let i = from; i < to; i++) {
      const v = Math.abs(samples[i] ?? 0);
      if (v > peak) peak = v;
    }
    if (peak > loudest) loudest = peak;
    out.push(peak);
  }

  // A silent file normalises to nothing rather than to a full-height bar per bucket, which is
  // what dividing by zero would produce and would read as constant noise.
  if (loudest === 0) return out.map(() => 0);
  return out.map((p) => p / loudest);
}

/** Fetch and decode. Browser-only; returns `unavailable` with a reason rather than throwing. */
export async function loadPeaks(url: string, signal?: AbortSignal): Promise<PeaksResult> {
  const Ctx =
    typeof window !== "undefined"
      ? (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!Ctx) return { status: "unavailable", reason: "This browser cannot decode audio." };

  let ctx: AudioContext | null = null;
  try {
    const res = await fetch(url, signal ? { signal } : {});
    if (!res.ok) return { status: "unavailable", reason: "The recording could not be read." };
    const buf = await res.arrayBuffer();
    ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(buf);
    return { status: "ok", peaks: bucketPeaks(decoded.getChannelData(0)) };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { status: "unavailable", reason: "Cancelled." };
    }
    return { status: "unavailable", reason: "This recording's waveform could not be drawn." };
  } finally {
    // Every decode opens a context, and a tab that leaves them open runs out of them.
    void ctx?.close().catch(() => {});
  }
}
