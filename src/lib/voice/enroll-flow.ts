/**
 * From a finished recording to a stored number, and back to nothing.
 *
 * THE ORDER IS THE PRIVACY PROMISE. The screen tells a rep "the audio is deleted
 * from this phone as soon as the number is worked out". That is only true if the
 * delete happens after DECODING and before anything touches the network - so a
 * server that is down, a rep who walks out of signal, or a 422 all leave the
 * phone holding no audio. A delete that runs "after a successful save" would
 * make the promise conditional on the network, which is exactly when a rep is
 * least able to check.
 *
 *     bytes = read(uri)         the file is needed to derive the number
 *     samples = decode(bytes)   ... and only to derive the number
 *     deleteFile(uri)           so it goes now, before the network exists
 *     save({ f0Hz, frames })    only the number travels
 *
 * INJECTABLE, because every one of those steps is a native module and the
 * ORDERING is the thing worth testing. The real implementations are wired in
 * `enroll-flow-deps.ts`; this file has no native import and is therefore loadable
 * by the test runner.
 */
import { decodeWav, WavError } from './wav';
import {
  deriveEnrollmentF0,
  f0Series,
  takeProblem,
  type EnrollmentResult,
  type TakeProblem,
} from './enrollment';
// TYPE-ONLY, and load-bearing: `import type` is erased before this runs, so
// naming the API module here creates no runtime dependency on it.
import type { SaveResult } from './enrollment-api';

export type EnrollDeps = {
  readBytes: (uri: string) => Promise<Uint8Array>;
  /** Best-effort and never awaited for correctness - the number is already out. */
  deleteFile: (uri: string) => void;
  save: (body: { f0Hz: number; voicedFrames: number }) => Promise<SaveResult>;
};

export type EnrollOutcome =
  | { kind: 'enrolled'; f0Hz: number; voicedFrames: number }
  /** The take itself was not good enough. The rep reads again. */
  | { kind: 'take-refused'; problem: Exclude<TakeProblem, null> }
  /** The file could not be read as audio at all. */
  | { kind: 'unreadable'; problem: 'not-wav' | 'unsupported-format' | 'empty' }
  /** Migration 0246 has not applied here. Not the rep's problem. */
  | { kind: 'unavailable' }
  | { kind: 'needs-shim' }
  | { kind: 'failed'; message?: string };

export async function enrollFromRecording(
  uri: string,
  deps: EnrollDeps,
): Promise<EnrollOutcome> {
  let result: EnrollmentResult | null;
  try {
    const bytes = await deps.readBytes(uri);
    const audio = decodeWav(bytes);
    result = deriveEnrollmentF0(f0Series(audio.samples, audio.sampleRate));
  } catch (e) {
    // The file is gone even on a decode failure. A take this app could not read
    // is exactly the one with no reason to survive on the phone.
    deps.deleteFile(uri);
    if (e instanceof WavError) return { kind: 'unreadable', problem: e.problem };
    return { kind: 'failed', message: e instanceof Error ? e.message : undefined };
  }

  // BEFORE the network, always. See the note at the top.
  deps.deleteFile(uri);

  const problem = takeProblem(result);
  if (problem !== null || result === null) {
    return { kind: 'take-refused', problem: problem ?? 'too-quiet' };
  }

  const saved = await deps.save({ f0Hz: result.f0Hz, voicedFrames: result.voicedFrames });
  if (saved.ok) {
    // The SERVER's number is the one that was stored, and it is what comes back
    // on the next read. Echoing the phone's would let the two drift apart with
    // nothing to show for it.
    return {
      kind: 'enrolled',
      f0Hz: saved.status.f0Hz ?? result.f0Hz,
      voicedFrames: result.voicedFrames,
    };
  }
  switch (saved.reason) {
    case 'take-refused':
      // The server re-runs the same checks. If it disagrees with us, its answer
      // wins - it is the one that decides what gets stored.
      return { kind: 'take-refused', problem: 'too-quiet' };
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'needs-shim':
      return { kind: 'needs-shim' };
    default:
      return { kind: 'failed', message: saved.message };
  }
}
