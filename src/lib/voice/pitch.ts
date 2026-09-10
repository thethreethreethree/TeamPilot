/**
 * Estimating the fundamental frequency of a frame of speech.
 *
 * PORTED TERM FOR TERM from the web's `lib/coach/v5/pitchSeparation.ts`, read
 * rather than remembered. The rep's enrolled number has to mean the same thing on
 * both sides: the server re-validates it against the SAME 70-400 Hz band, and a
 * phone that measured pitch even slightly differently would enrol a rep at a
 * number their own live sessions never produce. Every constant below is the web's
 * constant, and the algorithm is the web's algorithm.
 *
 * WHY McLEOD AND NOT PLAIN AUTOCORRELATION. Autocorrelation's tallest peak is
 * often the SECOND period, not the first, so it reports half the true pitch — the
 * octave error. A rep enrolled an octave down would be permanently mismatched
 * against themselves. MPM takes the FIRST peak within `PEAK_K` of the tallest,
 * which is the true period.
 *
 * PURE, AND FREE OF NATIVE IMPORTS ON PURPOSE. This app's test runner strips
 * types rather than compiling, so a module that reaches `expo-audio` cannot be
 * loaded by a test at all. The arithmetic that decides what number gets written
 * to a rep's profile is exactly the thing that must be tested, so it lives here
 * and the microphone lives somewhere else.
 */

/** The trusted human speaking range. The server validates against these too. */
export const MIN_F0 = 70;
export const MAX_F0 = 400;

/** Below this RMS a frame is silence or room noise, not a voice. */
const RMS_GATE = 0.012;
/** NSDF clarity: a real voiced peak sits high, noise does not. */
const CLARITY_GATE = 0.7;
/** MPM "first peak" acceptance, relative to the tallest NSDF peak. */
const PEAK_K = 0.85;

/**
 * The fundamental frequency of one mono PCM frame in Hz, or null when the frame
 * is too quiet or has no clear periodicity.
 *
 * NULL IS A REAL ANSWER HERE and it is most of them. A six-second read is mostly
 * gaps, breaths and consonants; only the voiced vowels carry a pitch. Returning
 * a number for an unvoiced frame is how a rep gets enrolled at the pitch of their
 * air conditioner.
 */
export function detectF0(frame: Float32Array, sampleRate: number): number | null {
  const n = frame.length;
  if (n < 2) return null;

  let rms = 0;
  for (let i = 0; i < n; i += 1) rms += frame[i]! * frame[i]!;
  rms = Math.sqrt(rms / n);
  if (rms < RMS_GATE) return null;

  const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_F0));
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_F0));
  if (maxLag <= minLag) return null;

  // Normalised Square Difference Function (McLeod). Allocated per call rather
  // than kept in a module-level scratch buffer: the web reuses one because it
  // runs inside a real-time audio callback, and this runs once over a file that
  // has already finished recording. A shared mutable buffer would be a hazard
  // for no gain.
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i + lag < n; i += 1) {
      acf += frame[i]! * frame[i + lag]!;
      m += frame[i]! * frame[i]! + frame[i + lag]! * frame[i + lag]!;
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }

  let globalMax = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (nsdf[lag]! > globalMax) globalMax = nsdf[lag]!;
  }
  if (globalMax < CLARITY_GATE) return null;

  // The FIRST peak within PEAK_K of the tallest is the true period; the taller
  // peaks after it are its multiples. Taking the tallest is the octave error.
  const threshold = PEAK_K * globalMax;
  let chosenLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    const prev = nsdf[lag - 1]!;
    const cur = nsdf[lag]!;
    const next = nsdf[lag + 1]!;
    if (cur > prev && cur >= next && cur >= threshold) {
      chosenLag = lag;
      break;
    }
  }
  if (chosenLag < 0) return null;

  // Parabolic interpolation for sub-sample accuracy. At 16 kHz one whole lag is
  // several Hz near the top of the range, so without this the enrolled number
  // would be quantised to the sample grid.
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
