/**
 * The recorder's settings, kept apart from the code that saves a file.
 *
 * WHY THIS IS ITS OWN MODULE. These options are the one thing in the capture
 * path that needs `expo-audio`, and `expo-audio` is a native module: anything
 * that imports it drags a native dependency behind it. That put the DURABILITY
 * code — deciding whether an interrupted call can be recovered — behind a module
 * that cannot load without a device, so the recovery path could not be tested at
 * all. A rule about not losing recordings, provable only on the hardware where
 * losing one is unrecoverable, is not much of a rule.
 *
 * Splitting them costs one file and buys a recovery path that is exercised on
 * every run.
 *
 * THE SIZE DECISION, AND WHERE THE NUMBER CAME FROM. The server refuses an
 * upload over 25 MB — `AGENT_MAX_BYTES` in TeamPilot's `src/lib/storage/assets.ts`,
 * read rather than assumed. `RecordingPresets.HIGH_QUALITY` is 44.1 kHz stereo at
 * 128 kbps, which is about 960 KB a minute and therefore hits that ceiling at
 * roughly 26 minutes. A door-to-door pitch usually fits; a long appointment does
 * not, and the failure would arrive AFTER the call, when the recording can no
 * longer be re-taken.
 *
 * So this records speech, not music: mono, 22.05 kHz, 32 kbps AAC. That is about
 * 240 KB a minute, so the same 25 MB holds around 100 minutes. Speech recognition
 * gains nothing from a second channel or from frequencies above ~11 kHz, and the
 * transcription is the entire point of the file — losing an hour of a call to
 * preserve stereo would be the wrong trade.
 */
import { RecordingPresets, type RecordingOptions } from 'expo-audio';

import {
  CALL_BIT_RATE,
  CALL_CHANNELS,
  CALL_EXTENSION,
  CALL_SAMPLE_RATE,
} from './recording-format';

/**
 * Speech-shaped recording options. See the size reasoning above — this is a
 * deliberate departure from HIGH_QUALITY, not an oversight.
 */
export const CALL_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: CALL_EXTENSION,
  sampleRate: CALL_SAMPLE_RATE,
  numberOfChannels: CALL_CHANNELS,
  bitRate: CALL_BIT_RATE,
};
