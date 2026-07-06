import { describe, it, expect } from "vitest";
import { detectF0, PitchSeparator, shouldNudgeAnchor } from "../pitchSeparation";

const SR = 16000;
const N = 4096;

/** A synthetic voiced frame at `freq` Hz. `harmonics` adds 2nd + 3rd
 *  partials to mimic a real (harmonic-rich) voice and test octave resistance. */
function tone(freq: number, harmonics = false): Float32Array {
  const f = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0.5 * Math.sin((2 * Math.PI * freq * i) / SR);
    if (harmonics) {
      s += 0.25 * Math.sin((2 * Math.PI * 2 * freq * i) / SR);
      s += 0.15 * Math.sin((2 * Math.PI * 3 * freq * i) / SR);
    }
    f[i] = s;
  }
  return f;
}

describe("detectF0", () => {
  it("detects pure tones across the voice range within 3%", () => {
    for (const freq of [90, 120, 150, 180, 220, 300]) {
      const est = detectF0(tone(freq), SR);
      expect(est).not.toBeNull();
      expect(Math.abs(est! - freq) / freq).toBeLessThan(0.03);
    }
  });

  it("resists octave error on a harmonic-rich tone", () => {
    const est = detectF0(tone(120, true), SR);
    expect(est).not.toBeNull();
    expect(Math.abs(est! - 120)).toBeLessThan(6); // not ~60 or ~240
  });

  it("returns null on silence", () => {
    expect(detectF0(new Float32Array(N), SR)).toBeNull();
  });

  it("detects near-edge voices (75 Hz deep + 380 Hz high)", () => {
    // The detectable window is a hair INSIDE [MIN_F0, MAX_F0]: the peak-pick
    // loop reserves one lag of margin each side for parabolic interpolation, so
    // an exact-70/400 fundamental honestly returns null rather than a wrong
    // value. These near-edge voices (very deep male / very high female) are the
    // realistic boundaries a real in-person pair actually hits — and must
    // resolve. Looser tol at 380 Hz where lag resolution is coarsest (~42 spl).
    for (const freq of [75, 380]) {
      const est = detectF0(tone(freq), SR);
      expect(est).not.toBeNull();
      expect(Math.abs(est! - freq) / freq).toBeLessThan(0.06);
    }
  });

  it("never emits a confident pitch OUTSIDE the voice range", () => {
    // The invariant behind pitch attribution: an out-of-range source (sub-bass
    // rumble, a high whistle, non-speech) must resolve to null — NEVER a
    // confident wrong F0 that would mislabel a speaker. It may lock onto a
    // harmonic inside the range; it must never report a value outside [70, 400].
    for (const freq of [40, 55, 500, 700]) {
      const est = detectF0(tone(freq), SR);
      if (est !== null) {
        expect(est).toBeGreaterThanOrEqual(70);
        expect(est).toBeLessThanOrEqual(400);
      }
    }
  });
});

describe("PitchSeparator", () => {
  function runTurn(sep: PitchSeparator, freq: number, anchor = false) {
    for (let k = 0; k < 12; k++) {
      sep.pushFrame(detectF0(tone(freq), SR), anchor);
    }
    return sep.labelTurn();
  }

  it("clusters two distinct pitches into agent vs customer", () => {
    const sep = new PitchSeparator();
    runTurn(sep, 120); // first turn seeds the agent cluster
    const c1 = runTurn(sep, 220); // distinct pitch seeds the customer cluster
    expect(c1.speaker).toBe("customer");

    const a = runTurn(sep, 122); // near the agent cluster
    const c = runTurn(sep, 218); // near the customer cluster
    expect(a.speaker).toBe("agent");
    expect(c.speaker).toBe("customer");
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it("reports low confidence when the two voices are near-identical (§3.4 honesty)", () => {
    const sep = new PitchSeparator();
    runTurn(sep, 120);
    runTurn(sep, 126); // within the min-gap → cannot honestly split
    const c = runTurn(sep, 121);
    expect(c.confidence).toBeLessThan(0.3);
  });

  it("does not fabricate a second speaker when only one voice is present (agent-only / video)", () => {
    // The video reality: the mic is agent-only (the prospect is on the far end
    // of the call, not in the mic). Several turns, all one voice with natural
    // jitter. The separator must NOT hallucinate a confident "prospect" cluster
    // — that would show phantom prospect turns on a video call (§3.4).
    const sep = new PitchSeparator();
    runTurn(sep, 120);
    runTurn(sep, 123);
    runTurn(sep, 119);
    const last = runTurn(sep, 121);
    // No phantom customer cluster forms from a single voice...
    expect(sep.centroids().customerF0).toBeNull();
    // ...and the separator stays honestly unconfident about splitting speakers.
    expect(last.confidence).toBeLessThan(0.3);
  });

  it("uses the manual 'I'm speaking' anchor to ground the agent cluster", () => {
    const sep = new PitchSeparator();
    runTurn(sep, 130, true); // rep speaking, anchored
    const { agentF0 } = sep.centroids();
    expect(agentF0).not.toBeNull();
    expect(Math.abs(agentF0! - 130)).toBeLessThan(6);
  });

  it("isAnchored flips only after the manual anchor is used (F2)", () => {
    const sep = new PitchSeparator();
    expect(sep.isAnchored()).toBe(false);
    sep.pushFrame(detectF0(tone(130), SR), false);
    expect(sep.isAnchored()).toBe(false);
    sep.pushFrame(detectF0(tone(130), SR), true);
    expect(sep.isAnchored()).toBe(true);
  });

  it("a ground-truth-agent turn never corrupts the customer cluster (F5)", () => {
    const sep = new PitchSeparator();
    runTurn(sep, 120); // agent cluster ~120
    runTurn(sep, 220); // customer cluster ~220
    const customerBefore = sep.centroids().customerF0!;
    // A turn whose pitch (215) sits near the CUSTOMER band, but the rep held
    // "I'm speaking" — nearest-assignment WOULD wrongly update customer; the
    // ground-truth override must send it to the agent cluster instead.
    for (let k = 0; k < 12; k++) sep.pushFrame(detectF0(tone(215), SR), false);
    const lbl = sep.labelTurn("agent");
    expect(lbl.speaker).toBe("agent");
    expect(sep.centroids().customerF0).toBe(customerBefore); // untouched
  });
});

describe("shouldNudgeAnchor — the pitch-anchor nudge spec (§4 thresholds)", () => {
  const opts = { lowThreshold: 0.5, minTurns: 3 };

  it("nudges when >=2 of the last 3 turns separate with low confidence, unanchored", () => {
    expect(
      shouldNudgeAnchor({ anchored: false, recentConfidences: [0.4, 0.8, 0.3], ...opts })
    ).toBe(true);
  });

  it("does NOT nudge once the split is anchored (the rep already fixed it)", () => {
    expect(
      shouldNudgeAnchor({ anchored: true, recentConfidences: [0.1, 0.1, 0.1], ...opts })
    ).toBe(false);
  });

  it("does NOT nudge before minTurns of history (no nagging on turn 1-2)", () => {
    expect(
      shouldNudgeAnchor({ anchored: false, recentConfidences: [0.1, 0.1], ...opts })
    ).toBe(false);
  });

  it("does NOT nudge when confidence has recovered (only 1 recent low)", () => {
    expect(
      shouldNudgeAnchor({ anchored: false, recentConfidences: [0.4, 0.9, 0.85], ...opts })
    ).toBe(false);
  });

  it("boundary: confidence exactly AT the threshold is not 'low' (strictly below)", () => {
    expect(
      shouldNudgeAnchor({ anchored: false, recentConfidences: [0.5, 0.5, 0.5], ...opts })
    ).toBe(false);
  });
});
