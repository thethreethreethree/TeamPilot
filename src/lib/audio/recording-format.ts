/**
 * The shape of a call recording, as plain numbers.
 *
 * WHY THESE ARE NOT IN THE OPTIONS OBJECT. The `expo-audio` options object is
 * the only thing in the capture path that needs a NATIVE module, and anything
 * importing it inherits that. These numbers are also what the disk-space
 * arithmetic and the durability code reason about — and putting a native
 * dependency behind "can this interrupted call still be recovered?" meant that
 * question could only be answered on a device, which is precisely where losing
 * the answer is unrecoverable.
 *
 * So the facts live here with no imports at all, `recording-options.ts` builds
 * the recorder's options from them, and everything else reads the facts.
 *
 * WHERE THE NUMBERS CAME FROM. The server refuses an upload over 25 MB —
 * `AGENT_MAX_BYTES` in TeamPilot's `src/lib/storage/assets.ts`, read rather than
 * assumed. `RecordingPresets.HIGH_QUALITY` is 44.1 kHz stereo at 128 kbps, about
 * 960 KB a minute, which hits that ceiling at roughly 26 minutes. A door-to-door
 * pitch usually fits; a long appointment does not, and the failure would arrive
 * AFTER the call, when the recording can no longer be re-taken.
 *
 * So this records speech, not music: mono, 22.05 kHz, 32 kbps AAC — about 240 KB
 * a minute, so the same 25 MB holds around 100 minutes. Speech recognition gains
 * nothing from a second channel or from frequencies above ~11 kHz, and the
 * transcription is the entire point of the file. Losing an hour of a call to
 * preserve stereo would be the wrong trade.
 */

/** Bits per second. Everything that estimates a recording's size reads this. */
export const CALL_BIT_RATE = 32000;

/** Hz. Speech, not music — see the header. */
export const CALL_SAMPLE_RATE = 22050;

/** Mono. A second channel doubles the file and adds nothing a transcript uses. */
export const CALL_CHANNELS = 1;

export const CALL_EXTENSION = '.m4a';
