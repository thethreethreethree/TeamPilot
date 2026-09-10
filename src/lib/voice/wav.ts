/**
 * Reading a recorded WAV into the samples the pitch detector wants.
 *
 * WHY THE APP PARSES A FILE INSTEAD OF STREAMING THE MICROPHONE. The web does
 * enrollment live, frame by frame, through Web Audio. React Native has no
 * equivalent without a NEW NATIVE MODULE, and a native plugin has already cost
 * this project an EAS build once. So the read is recorded to a short linear-PCM
 * file with the recorder the app already ships, the bytes are read back, and the
 * same per-frame analysis runs over them. The rep waits about a second longer and
 * the app gains no new native dependency.
 *
 * The trade is honest and worth naming: there is no live "N voiced frames"
 * counter while the rep speaks, because nothing is measured until the file is
 * closed. The screen shows the count after the take instead, and asks for another
 * one when it is short.
 *
 * WHY IT DOES NOT ASSUME THE HEADER. A WAV is not "44 bytes then samples". iOS
 * writes a `LIST`/`INFO` chunk between `fmt ` and `data` often enough that a
 * fixed offset reads metadata as audio — which is not silence, it is NOISE, and
 * noise has a pitch. The chunks are walked.
 *
 * PURE: no `expo-file-system`, no `expo-audio`. It takes bytes and returns
 * numbers, so the parsing is tested rather than trusted to a device.
 */

export type WavAudio = {
  /** Mono samples in [-1, 1]. Multi-channel input is averaged down. */
  samples: Float32Array;
  sampleRate: number;
};

/** Why a file could not be read as speech. */
export type WavProblem = 'not-wav' | 'unsupported-format' | 'empty' | null;

export class WavError extends Error {
  readonly problem: Exclude<WavProblem, null>;
  constructor(problem: Exclude<WavProblem, null>) {
    super(problem);
    this.problem = problem;
  }
}

const ascii = (view: DataView, at: number, len: number): string => {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(view.getUint8(at + i));
  return s;
};

/**
 * Decode a RIFF/WAVE file of 16- or 32-bit linear PCM (or 32-bit float).
 *
 * THROWS RATHER THAN RETURNING A GUESS. A half-understood header would hand the
 * pitch detector arbitrary bytes, and it would dutifully report a frequency for
 * them — a rep enrolled at the pitch of a metadata chunk. There is no honest
 * partial answer here.
 */
export function decodeWav(bytes: Uint8Array): WavAudio {
  if (bytes.length < 12) throw new WavError('not-wav');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WAVE') {
    throw new WavError('not-wav');
  }

  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let format = 0;
  let dataAt = -1;
  let dataLen = 0;

  // Walk the chunks. iOS writes LIST/INFO between fmt and data often enough that
  // a fixed 44-byte offset reads metadata as audio.
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = ascii(view, at, 4);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ' && body + 16 <= bytes.length) {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataAt = body;
      // A truncated recording (the app was killed mid-write) declares more data
      // than the file holds. Take what is really there rather than reading off
      // the end — a short take is answerable, a crash is not.
      dataLen = Math.min(size, bytes.length - body);
    }
    // Chunks are word-aligned: an odd size carries a pad byte.
    at = body + size + (size % 2);
  }

  if (dataAt < 0 || sampleRate <= 0 || channels <= 0) throw new WavError('not-wav');
  // 1 = PCM, 3 = IEEE float. 0xFFFE (extensible) is not handled: its real format
  // lives in a sub-chunk, and guessing is how the noise gets in.
  if (format !== 1 && format !== 3) throw new WavError('unsupported-format');
  if (!(bitsPerSample === 16 || bitsPerSample === 32)) throw new WavError('unsupported-format');
  if (format === 3 && bitsPerSample !== 32) throw new WavError('unsupported-format');

  const bytesPerSample = bitsPerSample / 8;
  const frames = Math.floor(dataLen / (bytesPerSample * channels));
  if (frames <= 0) throw new WavError('empty');

  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f += 1) {
    let sum = 0;
    for (let c = 0; c < channels; c += 1) {
      const off = dataAt + (f * channels + c) * bytesPerSample;
      if (format === 3) {
        sum += view.getFloat32(off, true);
      } else if (bitsPerSample === 16) {
        // 32768, not 32767: the negative extreme is -32768, and dividing by
        // 32767 pushes it past -1. It changes no pitch, and it is still wrong.
        sum += view.getInt16(off, true) / 32768;
      } else {
        sum += view.getInt32(off, true) / 2147483648;
      }
    }
    out[f] = sum / channels;
  }

  return { samples: out, sampleRate };
}

/** What a rep reads when the file could not be understood. */
export function wavProblemText(problem: Exclude<WavProblem, null>): string {
  switch (problem) {
    case 'empty':
      return 'The recording came out empty. Check that this app is allowed to use the microphone, then try again.';
    case 'not-wav':
    case 'unsupported-format':
    default:
      // Deliberately not "unsupported WAV format" — a rep can do nothing with
      // that. What they CAN do is try again, and tell someone if it keeps going.
      return 'This phone recorded the take in a form the app could not read. Try again, and tell your manager if it keeps happening.';
  }
}
