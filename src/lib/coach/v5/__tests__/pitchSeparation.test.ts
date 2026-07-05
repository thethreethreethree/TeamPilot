import { describe, it, expect } from "vitest";
import { detectF0, PitchSeparator } from "../pitchSeparation";

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

  it("uses the manual 'I'm speaking' anchor to ground the agent cluster", () => {
    const sep = new PitchSeparator();
    runTurn(sep, 130, true); // rep speaking, anchored
    const { agentF0 } = sep.centroids();
    expect(agentF0).not.toBeNull();
    expect(Math.abs(agentF0! - 130)).toBeLessThan(6);
  });
});
