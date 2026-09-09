import { MIN_F0, MAX_F0 } from "./pitchSeparation";

/**
 * Voice enrollment — the acoustic-reference core (partner meeting 9/2, founder 2026-09-09).
 *
 * The rep reads a short prompt once; the client runs the SAME detectF0 the live coach uses (McLeod method,
 * pitchSeparation.ts) over the mic frames and collects a per-frame F0 series. This module turns that series
 * into a single stored number — the rep's median fundamental frequency (Hz) — which later SEEDS the live
 * pitch clusterer's agent centroid so the rep's turns are identified against their KNOWN pitch from turn 1.
 *
 * We store an F0 NUMBER, never the audio — so enrollment stays off the biometric-data surface by
 * construction, and the "reference" is the same cheap acoustic signal the attribution already runs on.
 *
 * Pure + isomorphic: runs client-side at capture to produce the number, and the same validity check runs
 * server-side on the submitted number. §3.4 — too little voiced signal returns null (ask for another take),
 * never a stored garbage reference.
 */

/** Minimum in-range voiced frames before we trust the median. A rep who stayed silent, whose mic didn't
 *  capture, or who was in a noisy room produces too few — we ask for another take rather than store noise.
 *  Enrollment uses a 2048-sample buffer at 16 kHz (~8 F0 frames/sec), so 25 voiced frames is roughly three
 *  seconds of actual voiced speech within a ~6-second read. */
export const MIN_VOICED_FRAMES = 25;

export type EnrollmentResult = { f0Hz: number; voicedFrames: number };

/**
 * Derive the enrolled F0 from the per-frame F0 samples captured during enrollment (nulls = unvoiced/silent
 * frames detectF0 rejected). Keep only in-range voiced frames, require a minimum count, and return the
 * MEDIAN (robust to the occasional octave slip). Null when there isn't enough clean voiced signal.
 */
export function deriveEnrollmentF0(
  f0Samples: readonly (number | null)[]
): EnrollmentResult | null {
  const voiced = f0Samples.filter(
    (f): f is number => f != null && Number.isFinite(f) && f >= MIN_F0 && f <= MAX_F0
  );
  if (voiced.length < MIN_VOICED_FRAMES) return null;
  const sorted = [...voiced].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return { f0Hz: Math.round(median * 10) / 10, voicedFrames: voiced.length };
}

/** Server-side re-validation of a client-submitted enrollment F0 — never store an out-of-range number. */
export function isValidEnrollmentF0(f0Hz: unknown): f0Hz is number {
  return typeof f0Hz === "number" && Number.isFinite(f0Hz) && f0Hz >= MIN_F0 && f0Hz <= MAX_F0;
}

/** The gate predicate: has this rep enrolled their voice? Drives the mandatory gate + the enroll prompt. */
export function isVoiceEnrolled(
  p: { voiceEnrolledAt?: string | null } | null | undefined
): boolean {
  return Boolean(p?.voiceEnrolledAt);
}
