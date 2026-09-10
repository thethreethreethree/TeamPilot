/**
 * Capturing a call, and getting the file somewhere it will survive.
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
 *
 * THE ORDER OF OPERATIONS ON STOP MATTERS. The recorder writes to a cache
 * location the OS may reclaim. The file is moved into the app's documents
 * directory and its existence recorded BEFORE anything is attempted over the
 * network, because a recording is the one thing in this app that cannot be
 * fetched again.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { addRecording, storeKeyFor, type PendingRecording } from './recording-store';
import { HumanError } from '@/lib/error-message';
/**
 * Re-exported so every existing importer keeps working. The definition moved to
 * recording-options.ts to keep the native `expo-audio` dependency out of this
 * file — see that module's header for why the durability code needed it out.
 */
import { newClientId } from './recording-id';
import {
  diskBudget,
  type DiskBudget,
} from './recording-budget';

// Re-exported so every existing importer of `capture` is unaffected by the split.
export { newClientId } from './recording-id';

export {
  MAX_RECORDING_SECONDS,
  MAX_UPLOAD_BYTES,
  remainingSecondsForSize,
  type DiskBudget,
} from './recording-budget';

/** Where recordings live until the server has them. */
const FOLDER = 'recordings';

/** What the sign route is told, and what Storage stores it as. */
export const CALL_MIME_TYPE = 'audio/m4a';



function recordingsDirectory(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Move a just-finished recording somewhere durable and write it into the store.
 *
 * Throws if the file cannot be secured. The caller must surface that WHILE the
 * original still exists — a swallowed failure here is a lost call, and the rep
 * would find out days later when the session never appeared.
 */
export async function persistRecording(params: {
  /**
   * Null when nobody is signed in. The recording is saved anyway, unattached,
   * and claimed at the next sign-in — a session that expired mid-conversation
   * must not cost the rep the conversation.
   */
  userId: string | null;
  /** Where the recorder left the file. */
  sourceUri: string;
  durationMs: number;
  label?: string | null;
  /**
   * A DOOR PITCH rather than a coaching session.
   *
   * Absent means session, which is what every recording was before this existed.
   * When present, the outcome and the rep's local date travel WITH the audio
   * into the durable store — so a pitch recorded in a dead zone still knows how
   * it ended when it eventually sends. Asking the rep again later, when they
   * have knocked forty more doors, would get a worse answer than asking now.
   */
  pitch?: { outcome: string; localDate: string } | null;
}): Promise<PendingRecording> {
  const { userId, sourceUri, durationMs, label, pitch } = params;

  const source = new File(sourceUri);
  if (!source.exists) {
    throw new HumanError('The recording file is missing. Nothing was saved.');
  }

  const clientId = newClientId();
  const destination = new File(recordingsDirectory(), `${clientId}.m4a`);

  await source.move(destination);

  // Measured after the move, from the file that actually exists, rather than
  // estimated from the duration — the sign route is told this number and a wrong
  // one gets the upload rejected after the call is over.
  const sizeBytes = destination.size ?? 0;
  if (sizeBytes === 0) {
    throw new HumanError('The recording saved as an empty file. Nothing was captured.');
  }

  return addRecording(storeKeyFor(userId), {
    clientId,
    fileUri: destination.uri,
    sizeBytes,
    durationMs,
    mimeType: CALL_MIME_TYPE,
    recordedAt: new Date().toISOString(),
    label: label?.trim() || null,
    ...(pitch
      ? {
          kind: 'pitch' as const,
          pitchOutcome: pitch.outcome,
          pitchLocalDate: pitch.localDate,
        }
      : {}),
  });
}

/**
 * Delete the audio for a recording. Called once the server has confirmed it
 * holds the file, or when the rep chooses to discard one.
 *
 * Never throws: a file that cannot be deleted is wasted space, and failing the
 * caller over it would turn a successful upload into a reported failure.
 */
export function deleteRecordingFile(fileUri: string): void {
  try {
    const file = new File(fileUri);
    if (file.exists) file.delete();
  } catch {
    /* wasted space, not lost data */
  }
}

/** True when the file behind a store entry is still there. */
export function recordingFileExists(fileUri: string): boolean {
  try {
    return new File(fileUri).exists;
  } catch {
    return false;
  }
}

/**
 * Whether there is room on the phone for a full-length recording.
 *
 * A door-to-door rep's phone is full of photos. Starting a recording onto a full
 * disk fails part-way through the conversation, and the rep finds out afterwards
 * — by which point the call is over and unrepeatable. Checking first costs
 * nothing and is the only point at which anything can be done about it.
 *
 * Headroom on top of the recording itself, because the OS needs somewhere to
 * work and a phone that is completely full misbehaves in ways that have nothing
 * to do with this app.
 */

export function diskSpaceForRecording(): DiskBudget {
  try {
    // The ONLY native part: reading the figure. The verdict is `diskBudget`,
    // which is pure and tested.
    return diskBudget(Paths.availableDiskSpace);
  } catch {
    // Unreadable on this platform or this build. Not knowing is not a reason to
    // refuse to record — the rep's call matters more than our certainty.
    return diskBudget(null);
  }
}

