/**
 * Pitch-based acoustic speaker separation for the live sales coach.
 *
 * The idea (founder 2026-07-06): Scribe gives us the words; separating *who
 * spoke* on a single mic is ours. Two people usually sit in different pitch
 * bands, and fundamental-frequency (F0) detection is a solved, cheap,
 * client-side problem — the same core a guitar/instrument tuner has used for
 * years. We run it in Web Audio on the mic frames we already have (no extra
 * latency, no vendor cost) and cluster utterances into two speakers by pitch.
 *
 * This is a COMPOSING SIGNAL (§A16), not a replacement: it joins the existing
 * loudness/proximity heuristic, the content-LLM attribution, and the manual
 * "I'm speaking" anchor. And it is HONEST about itself (§3.4): pitch separates
 * strongly when the two voices differ in F0 and degrades toward a coin-flip
 * when they don't (same gender, near-identical pitch) — so every label carries
 * a confidence derived from how far apart the two pitch clusters actually are.
 *
 * detectF0 uses the McLeod Pitch Method (NSDF + first-strong-peak +
 * parabolic interpolation) — chosen over plain autocorrelation because it
 * resists the octave errors that would scramble the clustering.
 *
 * Pure + framework-free so it is unit-testable with synthetic tones.
 */

export type PitchSpeaker = "agent" | "customer";

export type PitchLabel = {
  /** null when the utterance had no clear voiced pitch to judge. */
  speaker: PitchSpeaker | null;
  /** 0..1 — how trustworthy this label is, driven by cluster separation. */
  confidence: number;
  agentF0: number | null;
  customerF0: number | null;
};

// Human speaking F0 lives ~70–400 Hz. Outside this we don't trust it.
const MIN_F0 = 70;
const MAX_F0 = 400;
// Below this RMS a frame is treated as silence/noise (unvoiced).
const RMS_GATE = 0.012;
// NSDF clarity: a real voiced peak sits high; noise doesn't.
const CLARITY_GATE = 0.7;
// MPM "first peak" acceptance relative to the max NSDF peak.
const PEAK_K = 0.85;

/**
 * Estimate the fundamental frequency (Hz) of a mono PCM frame, or null when
 * the frame is too quiet or has no clear periodicity (unvoiced).
 */
export function detectF0(
  frame: Float32Array,
  sampleRate: number
): number | null {
  const n = frame.length;
  if (n < 2) return null;

  // RMS gate — skip silence.
  let rms = 0;
  for (let i = 0; i < n; i++) rms += frame[i]! * frame[i]!;
  rms = Math.sqrt(rms / n);
  if (rms < RMS_GATE) return null;

  const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_F0));
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_F0));
  if (maxLag <= minLag) return null;

  // Normalized Square Difference Function (McLeod).
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i + lag < n; i++) {
      acf += frame[i]! * frame[i + lag]!;
      m += frame[i]! * frame[i]! + frame[i + lag]! * frame[i + lag]!;
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }

  // Find NSDF peaks (local maxima above zero). Track the global max so we can
  // accept the FIRST peak within PEAK_K of it — that first peak is the true
  // period; later, taller peaks are its multiples (the octave-error trap).
  let globalMax = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (nsdf[lag]! > globalMax) globalMax = nsdf[lag]!;
  }
  if (globalMax < CLARITY_GATE) return null;

  const threshold = PEAK_K * globalMax;
  let chosenLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    const prev = nsdf[lag - 1]!;
    const cur = nsdf[lag]!;
    const next = nsdf[lag + 1]!;
    if (cur > prev && cur >= next && cur >= threshold) {
      chosenLag = lag;
      break;
    }
  }
  if (chosenLag < 0) return null;

  // Parabolic interpolation around the chosen peak for sub-sample accuracy.
  const a = nsdf[chosenLag - 1]!;
  const b = nsdf[chosenLag]!;
  const c = nsdf[chosenLag + 1]!;
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const refinedLag = chosenLag + shift;
  if (refinedLag <= 0) return null;

  const f0 = sampleRate / refinedLag;
  if (f0 < MIN_F0 || f0 > MAX_F0) return null;
  return f0;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

// Two clusters are "meaningfully different" pitches only past this gap (Hz).
// Below it we can't honestly claim two speakers from pitch alone.
const MIN_CLUSTER_GAP_HZ = 25;
// A gap of this size (Hz) or more is treated as full-confidence separation.
const CONFIDENT_GAP_HZ = 60;
// Centroid smoothing so one odd utterance doesn't yank a cluster.
const CENTROID_ALPHA = 0.25;

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Online two-speaker pitch clusterer. Fed per-frame F0 during an utterance;
 * asked to label the utterance when it ends. The manual "I'm speaking" anchor
 * seeds the agent cluster with ground truth so the labels are grounded, not
 * guessed from the first-speaker assumption.
 */
export class PitchSeparator {
  private frameF0s: number[] = [];
  private agentCentroid: number | null = null;
  private customerCentroid: number | null = null;

  reset(): void {
    this.frameF0s = [];
    this.agentCentroid = null;
    this.customerCentroid = null;
  }

  /**
   * Push one frame's F0. `isAgentAnchor` = the rep's manual "I'm speaking"
   * toggle is ON, so this frame is ground-truth agent and seeds/updates the
   * agent centroid directly (§ the correction trains the model).
   */
  pushFrame(f0: number | null, isAgentAnchor: boolean): void {
    if (f0 == null) return;
    this.frameF0s.push(f0);
    if (isAgentAnchor) {
      this.agentCentroid =
        this.agentCentroid == null
          ? f0
          : this.agentCentroid * (1 - CENTROID_ALPHA) + f0 * CENTROID_ALPHA;
    }
  }

  /** Current cluster centroids (for logging / display). */
  centroids(): { agentF0: number | null; customerF0: number | null } {
    return { agentF0: this.agentCentroid, customerF0: this.customerCentroid };
  }

  /**
   * Label the utterance that just ended by its median F0, update the assigned
   * cluster, and clear the per-utterance buffer. Confidence reflects how far
   * apart the two clusters are — low when they're near-identical (§3.4).
   */
  labelTurn(): PitchLabel {
    const f0 = median(this.frameF0s);
    this.frameF0s = [];
    if (f0 == null) {
      return {
        speaker: null,
        confidence: 0,
        agentF0: this.agentCentroid,
        customerF0: this.customerCentroid,
      };
    }

    // Bootstrap: first pitched turn seeds the agent cluster (unless a manual
    // anchor already did). Second DISTINCT pitch seeds the customer cluster.
    if (this.agentCentroid == null) {
      this.agentCentroid = f0;
      return {
        speaker: "agent",
        confidence: 0,
        agentF0: f0,
        customerF0: null,
      };
    }
    if (this.customerCentroid == null) {
      if (Math.abs(f0 - this.agentCentroid) >= MIN_CLUSTER_GAP_HZ) {
        this.customerCentroid = f0;
        return {
          speaker: "customer",
          confidence: this.confidenceFor(),
          agentF0: this.agentCentroid,
          customerF0: f0,
        };
      }
      // Same pitch band as the agent so far — can't split yet; keep as agent.
      this.agentCentroid =
        this.agentCentroid * (1 - CENTROID_ALPHA) + f0 * CENTROID_ALPHA;
      return {
        speaker: "agent",
        confidence: 0,
        agentF0: this.agentCentroid,
        customerF0: null,
      };
    }

    // Both clusters exist — assign to the nearer, update it.
    const dA = Math.abs(f0 - this.agentCentroid);
    const dC = Math.abs(f0 - this.customerCentroid);
    const speaker: PitchSpeaker = dA <= dC ? "agent" : "customer";
    if (speaker === "agent") {
      this.agentCentroid =
        this.agentCentroid * (1 - CENTROID_ALPHA) + f0 * CENTROID_ALPHA;
    } else {
      this.customerCentroid =
        this.customerCentroid * (1 - CENTROID_ALPHA) + f0 * CENTROID_ALPHA;
    }
    return {
      speaker,
      confidence: this.confidenceFor(),
      agentF0: this.agentCentroid,
      customerF0: this.customerCentroid,
    };
  }

  /** Confidence from cluster separation: near-identical pitch → ~0. */
  private confidenceFor(): number {
    if (this.agentCentroid == null || this.customerCentroid == null) return 0;
    const gap = Math.abs(this.agentCentroid - this.customerCentroid);
    if (gap < MIN_CLUSTER_GAP_HZ) return 0;
    return clamp01(gap / CONFIDENT_GAP_HZ);
  }
}
