/**
 * Voice enrollment: the WAV reader, the pitch detector, and the one number.
 *
 * WHY THESE TESTS EXIST AT ALL. The rep's enrolled number is written once and
 * compared against them forever. Every failure in this chain is silent and
 * permanent: a WAV header read at a fixed offset feeds metadata to the detector,
 * which reports a frequency for it; an octave error enrols a rep at half their
 * pitch; a mean instead of a median lets one slip move the answer. None of those
 * throw, none of them look wrong on screen, and all of them mean the rep is
 * measured against a stranger.
 *
 * The tones are synthetic on purpose — a known frequency in, the same frequency
 * out, within a Hz.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_F0, MIN_F0, detectF0 } from '@/lib/voice/pitch';
import {
  ENROLL_PRIVACY,
  ENROLL_SAMPLE_RATE,
  FRAME_SIZE,
  MIN_VOICED_FRAMES,
  deriveEnrollmentF0,
  f0Series,
  isValidEnrollmentF0,
  takeProblem,
  takeProblemText,
} from '@/lib/voice/enrollment';
import { WavError, decodeWav } from '@/lib/voice/wav';

/** A voice-ish tone: a fundamental plus two harmonics, which is what MPM is for. */
function tone(hz: number, samples: number, rate = ENROLL_SAMPLE_RATE, amp = 0.4): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = i / rate;
    out[i] =
      amp *
      (Math.sin(2 * Math.PI * hz * t) +
        0.5 * Math.sin(4 * Math.PI * hz * t) +
        0.25 * Math.sin(6 * Math.PI * hz * t));
  }
  return out;
}

// ---------------------------------------------------------------- the detector

test('a known tone comes back as the frequency it went in at', () => {
  for (const hz of [95, 120, 180, 240, 330]) {
    const got = detectF0(tone(hz, FRAME_SIZE), ENROLL_SAMPLE_RATE);
    assert.ok(got !== null, `${hz} Hz read as unvoiced`);
    assert.ok(Math.abs(got! - hz) < 2, `${hz} Hz came back as ${got}`);
  }
});

test('a harmonic-rich tone is NOT reported an octave down', () => {
  // The octave error is the whole reason this is McLeod and not autocorrelation:
  // plain autocorrelation's tallest peak is often the SECOND period. A rep
  // enrolled an octave out never matches themselves again.
  const got = detectF0(tone(200, FRAME_SIZE), ENROLL_SAMPLE_RATE)!;
  assert.ok(Math.abs(got - 200) < 2, `expected ~200, got ${got}`);
  assert.ok(Math.abs(got - 100) > 20, `reported the octave below: ${got}`);
});

test('silence and room noise are unvoiced, not a pitch', () => {
  assert.equal(detectF0(new Float32Array(FRAME_SIZE), ENROLL_SAMPLE_RATE), null);
  // Very quiet noise: under the RMS gate, so it must not produce a number.
  const hiss = new Float32Array(FRAME_SIZE);
  for (let i = 0; i < hiss.length; i += 1) hiss[i] = (i % 7) * 1e-4 - 3e-4;
  assert.equal(detectF0(hiss, ENROLL_SAMPLE_RATE), null);
});

test('a tone outside the human speaking range is refused, not clamped', () => {
  // 40 Hz and 900 Hz are not speech. Clamping either into the band would enrol
  // a rep at a number nothing about them produced.
  assert.equal(detectF0(tone(40, FRAME_SIZE), ENROLL_SAMPLE_RATE), null);
  const high = detectF0(tone(900, FRAME_SIZE), ENROLL_SAMPLE_RATE);
  assert.ok(high === null || (high >= MIN_F0 && high <= MAX_F0));
});

// ---------------------------------------------------------------- the number

test('the enrolled number is the MEDIAN, so one octave slip moves nothing', () => {
  const clean = Array.from({ length: 40 }, () => 180);
  // One frame slipped to half. A mean would drag the answer down by ~2 Hz and
  // keep dragging with every extra slip; the median does not move at all.
  const withSlip = [...clean.slice(0, 39), 90];
  assert.equal(deriveEnrollmentF0(clean)!.f0Hz, 180);
  assert.equal(deriveEnrollmentF0(withSlip)!.f0Hz, 180);
});

test('too little voiced speech returns NULL rather than a meaningless number', () => {
  const few = Array.from({ length: MIN_VOICED_FRAMES - 1 }, () => 180);
  assert.equal(deriveEnrollmentF0(few), null);
  const enough = Array.from({ length: MIN_VOICED_FRAMES }, () => 180);
  assert.equal(deriveEnrollmentF0(enough)!.voicedFrames, MIN_VOICED_FRAMES);
});

test('unvoiced frames and out-of-range readings are dropped, never counted', () => {
  const mixed = [
    ...Array.from({ length: 30 }, () => 200),
    ...Array.from({ length: 30 }, () => null),
    ...Array.from({ length: 10 }, () => 20),
    ...Array.from({ length: 10 }, () => 5000),
  ];
  const r = deriveEnrollmentF0(mixed)!;
  assert.equal(r.voicedFrames, 30);
  assert.equal(r.f0Hz, 200);
});

test('the range check matches the server, so a refusal is caught before the trip', () => {
  assert.equal(isValidEnrollmentF0(MIN_F0), true);
  assert.equal(isValidEnrollmentF0(MAX_F0), true);
  assert.equal(isValidEnrollmentF0(MIN_F0 - 1), false);
  assert.equal(isValidEnrollmentF0(MAX_F0 + 1), false);
  assert.equal(isValidEnrollmentF0('180'), false);
  assert.equal(isValidEnrollmentF0(Number.NaN), false);
});

test('a whole recording becomes one number', () => {
  // Six seconds of steady voice at 16 kHz is ~46 frames of 2048.
  const audio = tone(165, ENROLL_SAMPLE_RATE * 6);
  const series = f0Series(audio);
  assert.ok(series.length >= 40, `only ${series.length} frames`);
  const r = deriveEnrollmentF0(series)!;
  assert.ok(Math.abs(r.f0Hz - 165) < 2, `enrolled at ${r.f0Hz}`);
  assert.ok(r.voicedFrames >= MIN_VOICED_FRAMES);
});

test('a take that is mostly silence is refused with a fix the rep can act on', () => {
  const quiet = f0Series(new Float32Array(ENROLL_SAMPLE_RATE * 6));
  const r = deriveEnrollmentF0(quiet);
  assert.equal(r, null);
  assert.equal(takeProblem(r), 'too-quiet');
  const text = takeProblemText('too-quiet')!;
  assert.match(text, /read/i);
  assert.ok(!/error|invalid|failed/i.test(text), text);
  assert.equal(takeProblem({ f0Hz: 180, voicedFrames: 40 }), null);
  assert.equal(takeProblemText(null), null);
});

test('the privacy line says what is stored and what is not', () => {
  assert.match(ENROLL_PRIVACY, /number/i);
  assert.match(ENROLL_PRIVACY, /never store a recording/i);
});

// ---------------------------------------------------------------- the file

/** Build a WAV the way a recorder does, optionally with a chunk before `data`. */
function wavBytes(
  samples: Float32Array,
  rate = ENROLL_SAMPLE_RATE,
  opts: { extraChunk?: boolean; channels?: number } = {},
): Uint8Array {
  const channels = opts.channels ?? 1;
  const extra = opts.extraChunk ? 8 + 8 : 0;
  const dataLen = samples.length * 2 * channels;
  const buf = new ArrayBuffer(44 + extra + dataLen);
  const v = new DataView(buf);
  const put = (at: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(at + i, s.charCodeAt(i));
  };
  put(0, 'RIFF');
  v.setUint32(4, 36 + extra + dataLen, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  let at = 36;
  if (opts.extraChunk) {
    // The chunk iOS likes to insert. A fixed-44-byte reader treats these bytes
    // as audio, and metadata is not silence — it is noise, and noise has a pitch.
    put(at, 'LIST');
    v.setUint32(at + 4, 8, true);
    put(at + 8, 'INFOxxxx');
    at += 16;
  }
  put(at, 'data');
  v.setUint32(at + 4, dataLen, true);
  at += 8;
  for (let i = 0; i < samples.length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      v.setInt16(at + (i * channels + c) * 2, Math.round(samples[i]! * 32767), true);
      }
  }
  return new Uint8Array(buf);
}

test('a recorded WAV round-trips to the pitch it was written at', () => {
  const decoded = decodeWav(wavBytes(tone(190, ENROLL_SAMPLE_RATE * 4)));
  assert.equal(decoded.sampleRate, ENROLL_SAMPLE_RATE);
  const r = deriveEnrollmentF0(f0Series(decoded.samples, decoded.sampleRate))!;
  assert.ok(Math.abs(r.f0Hz - 190) < 2, `decoded to ${r.f0Hz}`);
});

test('a chunk between fmt and data does NOT get read as audio', () => {
  /*
   * THIS ASSERTS SAMPLE-FOR-SAMPLE, and the first version of it did not — which
   * is why it was rewritten. Checking only the derived pitch let a deliberate
   * fixed-44-byte offset PASS: a sixteen-byte slip is eight samples out of
   * sixty-four thousand, and a median does not notice eight samples. The test
   * agreed with the code while the code was wrong, which is worse than no test.
   *
   * What actually distinguishes a correct chunk walk from a fixed offset is
   * WHICH BYTES become sample zero, so that is what is compared.
   */
  const written = tone(190, ENROLL_SAMPLE_RATE * 4);
  const decoded = decodeWav(wavBytes(written, ENROLL_SAMPLE_RATE, { extraChunk: true }));
  for (let i = 0; i < 200; i += 1) {
    const expected = Math.round(written[i]! * 32767) / 32768;
    assert.ok(
      Math.abs(decoded.samples[i]! - expected) < 1e-6,
      `sample ${i}: got ${decoded.samples[i]}, expected ${expected} — the data chunk was not found`,
    );
  }
  const r = deriveEnrollmentF0(f0Series(decoded.samples, decoded.sampleRate))!;
  assert.ok(Math.abs(r.f0Hz - 190) < 2, `decoded to ${r.f0Hz}`);
});

test('stereo is averaged to mono rather than read as twice the samples', () => {
  const decoded = decodeWav(
    wavBytes(tone(190, ENROLL_SAMPLE_RATE * 4), ENROLL_SAMPLE_RATE, { channels: 2 }),
  );
  // Frames, not interleaved samples: a stereo file read as mono is twice as long
  // and every other sample belongs to the other channel.
  assert.equal(decoded.samples.length, ENROLL_SAMPLE_RATE * 4);
  const r = deriveEnrollmentF0(f0Series(decoded.samples, decoded.sampleRate))!;
  assert.ok(Math.abs(r.f0Hz - 190) < 2, `decoded to ${r.f0Hz}`);
});

test('a truncated file yields the audio it really holds, not a read off the end', () => {
  // The app was killed mid-write, so the header promises more than exists.
  const full = wavBytes(tone(190, ENROLL_SAMPLE_RATE * 4));
  const cut = full.slice(0, full.length - 20000);
  const decoded = decodeWav(cut);
  assert.ok(decoded.samples.length > 0);
  assert.ok(decoded.samples.length < ENROLL_SAMPLE_RATE * 4);
});

test('a file that is not a readable WAV throws instead of returning noise', () => {
  // There is no honest partial answer: the detector would report a frequency for
  // arbitrary bytes, and the rep would be enrolled at it.
  for (const bad of [new Uint8Array(0), new Uint8Array([1, 2, 3]), new TextEncoder().encode('not a wav at all')]) {
    assert.throws(() => decodeWav(bad), WavError);
  }
  const empty = wavBytes(new Float32Array(0));
  assert.throws(() => decodeWav(empty), (e: unknown) => (e as WavError).problem === 'empty');
});
