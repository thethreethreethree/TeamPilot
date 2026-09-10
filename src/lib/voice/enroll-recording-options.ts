/**
 * The recorder's settings for a voice-enrollment take.
 *
 * DELIBERATELY NOT THE CALL SETTINGS. A call is recorded as compressed AAC
 * because the file has to be uploaded and transcribed, and 32 kbps mono is the
 * right trade there. An enrollment take is never uploaded and never transcribed:
 * it exists for about a second, on this phone, so a pitch can be measured from
 * it. Compression is the one thing that would hurt — a lossy codec reshapes the
 * harmonics the McLeod method reads, and the whole point is a number that matches
 * the rep for years.
 *
 * So this is uncompressed 16-bit linear PCM, mono, 16 kHz — the exact form
 * `wav.ts` decodes and the exact rate `enrollment.ts` frames at. Six seconds is
 * about 190 KB, which is nothing for a file that is deleted immediately.
 *
 * WHY 16 kHz AND NOT MORE. The band that matters is 70-400 Hz. 16 kHz is already
 * forty times the top of it, and it is what the web's enrollment buffer assumes,
 * so both sides frame the same audio the same way.
 *
 * ANDROID IS NOT WIRED, and saying so is better than pretending. Android's
 * MediaRecorder does not write WAV, so an enrollment take there would need a
 * different container and a decoder for it. This app has never been compiled for
 * Android; when it is, that is the piece to build, and `decodeWav` will refuse
 * the file loudly rather than measuring the pitch of a header.
 */
import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';

export const ENROLL_EXTENSION = '.wav';
export const ENROLL_RATE = 16000;

export const ENROLL_RECORDING_OPTIONS: RecordingOptions = {
  extension: ENROLL_EXTENSION,
  sampleRate: ENROLL_RATE,
  numberOfChannels: 1,
  // Ignored for linear PCM (there is no bit rate to choose when nothing is
  // compressed); present because the type asks for it.
  bitRate: ENROLL_RATE * 16,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    // Present so the recorder does not fail to construct. What it writes is NOT
    // a WAV, and `decodeWav` will say so rather than guess — see the note above.
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/** How long the read runs before it stops itself, in milliseconds. */
export const ENROLL_DURATION_MS = 7000;
