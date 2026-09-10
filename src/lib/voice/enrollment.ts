/**
 * Turning a recorded read-aloud into the one number a rep's profile stores.
 *
 * WHAT IS STORED IS A NUMBER, NEVER A RECORDING. That is the whole design, and
 * it is the reason this feature is not biometrics: the rep's median speaking
 * pitch in Hz is the same cheap acoustic signal live attribution already runs on,
 * and it cannot be played back, matched against a stranger, or handed to anyone
 * as a voice. The audio file exists on the phone for a few seconds and is deleted
 * (see `enroll-flow.ts`); nothing about it leaves the device.
 *
 * PORTED FROM the web's `lib/coach/v5/voiceEnrollment.ts`, read rather than
 * remembered — the server re-validates the submitted number against its own copy
 * of these rules, so a phone that derived it differently would simply be refused.
 *
 * WHY A MEDIAN AND NOT A MEAN. One octave slip in a six-second read moves a mean
 * by twenty Hz and moves a median by nothing. The slip is the failure this whole
 * chain is built around.
 *
 * WHY A MINIMUM FRAME COUNT. A rep who stayed silent, whose microphone was
 * covered, or who read in a noisy van produces a handful of voiced frames and a
 * meaningless median. Too few is not "roughly right" — it is a number that will
 * never match them again. It returns null and the screen asks for another take.
 */
import { MAX_F0, MIN_F0, detectF0 } from './pitch';

/**
 * Voiced frames required before the median is trusted.
 *
 * The web's figure, and its reasoning: a 2048-sample window at 16 kHz is about
 * eight frames a second, so 25 voiced frames is roughly three seconds of ACTUAL
 * voiced speech inside a six-second read. The gap between six seconds of audio
 * and three seconds of voice is the breaths, gaps and consonants.
 */
export const MIN_VOICED_FRAMES = 25;

/** The analysis window, in samples. Matches the web's enrollment buffer. */
export const FRAME_SIZE = 2048;

/** The sample rate the read is captured at. */
export const ENROLL_SAMPLE_RATE = 16000;

export type EnrollmentResult = { f0Hz: number; voicedFrames: number };

/**
 * The enrolled F0 from a per-frame series, or null when there is not enough
 * clean voiced signal. Nulls in the input are frames `detectF0` rejected.
 */
export function deriveEnrollmentF0(
  f0Samples: readonly (number | null)[],
): EnrollmentResult | null {
  const voiced = f0Samples.filter(
    (f): f is number => f != null && Number.isFinite(f) && f >= MIN_F0 && f <= MAX_F0,
  );
  if (voiced.length < MIN_VOICED_FRAMES) return null;
  const sorted = [...voiced].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return { f0Hz: Math.round(median * 10) / 10, voicedFrames: voiced.length };
}

/** The same range check the server applies, so a refusal is caught before the trip. */
export function isValidEnrollmentF0(f0Hz: unknown): f0Hz is number {
  return typeof f0Hz === 'number' && Number.isFinite(f0Hz) && f0Hz >= MIN_F0 && f0Hz <= MAX_F0;
}

/**
 * Every frame's F0 across a whole recording.
 *
 * NON-OVERLAPPING WINDOWS, like the web's live path: overlapping them would
 * inflate the frame count without adding any new voice, and the minimum-frames
 * rule exists precisely to measure how much real voice there was.
 */
export function f0Series(
  samples: Float32Array,
  sampleRate: number = ENROLL_SAMPLE_RATE,
  frameSize: number = FRAME_SIZE,
): (number | null)[] {
  const out: (number | null)[] = [];
  if (frameSize < 2 || samples.length < frameSize) return out;
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    out.push(detectF0(samples.subarray(start, start + frameSize), sampleRate));
  }
  return out;
}

/** Why a take was refused, in the words the rep needs. */
export type TakeProblem = 'too-quiet' | 'out-of-range' | null;

/**
 * What is wrong with a finished take, if anything.
 *
 * TWO DIFFERENT FAILURES WITH TWO DIFFERENT FIXES, and collapsing them would
 * send a rep to the wrong one. Too few voiced frames means read for longer or
 * move somewhere quieter. A median outside the human range means something other
 * than a voice was measured, and reading louder will not help.
 */
export function takeProblem(result: EnrollmentResult | null): TakeProblem {
  if (result === null) return 'too-quiet';
  if (!isValidEnrollmentF0(result.f0Hz)) return 'out-of-range';
  return null;
}

/** What the rep reads when a take is refused. */
export function takeProblemText(problem: TakeProblem): string | null {
  switch (problem) {
    case 'too-quiet':
      return 'That take was mostly quiet. Read the whole line out loud, somewhere without much background noise, and try again.';
    case 'out-of-range':
      return 'That did not come out as a speaking voice. Hold the phone the way you normally would and read the line again.';
    default:
      return null;
  }
}

/** The line the rep reads. Long enough for three seconds of voiced speech. */
export const ENROLL_PROMPT =
  'Hi, my name is on this phone and I am here about the roof. I will only take a minute of your time.';

/** The promise, said where the rep decides. Not buried in a settings page. */
export const ENROLL_PRIVACY =
  'We store a pitch reference, which is a single number. We never store a recording of your voice, and the audio is deleted from this phone as soon as the number is worked out.';
