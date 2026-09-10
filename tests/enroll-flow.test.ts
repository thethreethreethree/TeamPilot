/**
 * The enrollment flow's ORDER, which is the privacy promise in code.
 *
 * The screen tells a rep "the audio is deleted from this phone as soon as the
 * number is worked out". A delete that ran after a successful save would make
 * that promise conditional on the network - true in the office, false in a
 * basement, and the rep has no way to tell which they got. These tests exist to
 * hold the ordering still, because nothing about a screenshot or a green build
 * can show it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { enrollFromRecording, type EnrollDeps } from '@/lib/voice/enroll-flow';
import { ENROLL_SAMPLE_RATE } from '@/lib/voice/enrollment';

/** A real 16-bit mono WAV of a steady tone, built the way a recorder writes one. */
function wav(hz: number, seconds: number): Uint8Array {
  const rate = ENROLL_SAMPLE_RATE;
  const n = rate * seconds;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const put = (at: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(at + i, s.charCodeAt(i));
  };
  put(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  put(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const s =
      0.4 *
      (Math.sin(2 * Math.PI * hz * t) +
        0.5 * Math.sin(4 * Math.PI * hz * t) +
        0.25 * Math.sin(6 * Math.PI * hz * t));
    v.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Uint8Array(buf);
}

type Call = 'read' | 'delete' | 'save';

function deps(over: Partial<EnrollDeps> = {}) {
  const calls: Call[] = [];
  const base: EnrollDeps = {
    readBytes: async () => {
      calls.push('read');
      return wav(185, 6);
    },
    deleteFile: () => {
      calls.push('delete');
    },
    save: async () => {
      calls.push('save');
      return { ok: true as const, status: { enrolled: true, f0Hz: 185.2 } };
    },
  };
  // The overrides are WRAPPED rather than swapped in, so a test that replaces
  // `save` still records that save was called. Swapping them made one ordering
  // assertion pass vacuously against an index of -1.
  const d: EnrollDeps = {
    readBytes: over.readBytes
      ? async (uri) => {
          calls.push('read');
          return over.readBytes!(uri);
        }
      : base.readBytes,
    deleteFile: over.deleteFile
      ? (uri) => {
          calls.push('delete');
          over.deleteFile!(uri);
        }
      : base.deleteFile,
    save: over.save
      ? async (body) => {
          calls.push('save');
          return over.save!(body);
        }
      : base.save,
  };
  return { calls, d };
}

test('the audio is deleted BEFORE anything is sent, not after a successful save', () => {
  return (async () => {
    const { calls, d } = deps();
    const out = await enrollFromRecording('file:///take.wav', d);
    assert.equal(out.kind, 'enrolled');
    assert.deepEqual(calls, ['read', 'delete', 'save']);
  })();
});

test('a failed save still leaves no audio on the phone', async () => {
  const { calls, d } = deps({
    save: async () => ({ ok: false as const, reason: 'failed' as const, message: 'offline' }),
  });
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'failed');
  assert.ok(calls.includes('delete'), 'the take survived a failed save');
  assert.ok(calls.indexOf('delete') < calls.indexOf('save'));
});

test('a file that cannot be read is deleted too', async () => {
  const { calls, d } = deps({ readBytes: async () => new Uint8Array([1, 2, 3]) });
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'unreadable');
  assert.ok(calls.includes('delete'), 'an unreadable take was left behind');
  assert.ok(!calls.includes('save'), 'nonsense was sent to the server');
});

test('a take that is too quiet never reaches the server', async () => {
  // Six seconds of silence: no voiced frames, so there is no number to send.
  const { calls, d } = deps({ readBytes: async () => wav(0, 6) });
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'take-refused');
  assert.ok(!calls.includes('save'));
  assert.ok(calls.includes('delete'));
});

test('the number the SERVER stored is what comes back, not the phone\'s', async () => {
  // The phone derives ~185; the server echoes 185.2. Reporting the phone's would
  // let the two drift apart with nothing on screen to show it.
  const { d } = deps();
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'enrolled');
  assert.equal(out.kind === 'enrolled' && out.f0Hz, 185.2);
});

test('a pending migration is its own outcome, not something to retry', async () => {
  // 503 means the column does not exist here. Telling the rep to read again
  // would send them in a circle at something that will never work today.
  const { d } = deps({ save: async () => ({ ok: false as const, reason: 'unavailable' as const }) });
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'unavailable');
});

test('the server refusing a take wins over the phone accepting it', async () => {
  const { d } = deps({
    save: async () => ({ ok: false as const, reason: 'take-refused' as const }),
  });
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'take-refused');
});

test('a signed-out rep is told that, not that their voice was too quiet', async () => {
  const { d } = deps({
    save: async () => ({ ok: false as const, reason: 'needs-shim' as const, why: 'signed-out' as const }),
  });
  const out = await enrollFromRecording('file:///take.wav', d);
  assert.equal(out.kind, 'needs-shim');
});
