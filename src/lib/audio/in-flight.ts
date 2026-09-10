/**
 * Surviving a call that never got to stop.
 *
 * THE HOLE THIS CLOSES, read out of capture.ts rather than guessed. The recorder
 * writes into a cache location "the OS may reclaim", and the file is only moved
 * somewhere durable — and only written into the recording store — when the rep
 * presses Stop. Everything between Start and Stop is therefore invisible to this
 * app: if it is killed mid-call by a crash, by iOS reclaiming memory while the
 * phone is in a pocket, or by the battery going flat, the recorder's file is left
 * in a directory nothing is watching, under a name nothing has written down. The
 * next launch has no idea a call ever happened.
 *
 * That is the worst loss in the product. A recording is the one thing here that
 * cannot be fetched again — the store's own comment says so — and the calls most
 * likely to be interrupted are the long ones, which are the ones worth keeping.
 *
 * WHAT THIS DOES. It writes down, at the moment recording STARTS, where the file
 * is and when it began. One small marker. If the app comes back and the marker is
 * still there, the last session ended without a Stop, and the file — if the OS
 * has not already reclaimed it — is recovered into the recording store exactly as
 * a normal Stop would have done.
 *
 * WHY A MARKER AND NOT CHUNKED UPLOADS. The backend does have a durability
 * endpoint that takes a chunk every ~15s during a call, and that is the stronger
 * answer for a call recorded in the browser, where the tab can vanish. On a phone
 * the file is already on the device's own disk the whole time; what was missing
 * was not the bytes but the RECORD of where they are. A marker fixes the actual
 * gap, needs no network during the call, and spends no battery or data allowance
 * on a rep who is standing in a dead zone — which is where these calls happen.
 *
 * IT NEVER CLAIMS MORE THAN IT KNOWS. A recovered file has no duration: the app
 * was not running when it ended, and inventing a number from the start time would
 * be a fabricated fact about a real call. It is stored as zero and the screen says
 * the length is unknown. And if the marker is there but the file is gone, that is
 * reported too — a rep who lost a call is owed the knowledge that it happened,
 * not silence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

import { persistRecording } from './capture';
import type { PendingRecording } from './recording-store';

/**
 * One key for the whole device, not one per user.
 *
 * A call can be recorded while signed out — the app supports that deliberately,
 * because a session expiring mid-conversation must not cost the rep the
 * conversation — so at the moment the marker is written there may be no user to
 * key it by. Recovery hands the file to the same unclaimed bucket that path
 * already uses, and it is claimed at the next sign-in.
 */
const KEY = 'recording.inflight.v1';

export type InFlightMarker = {
  /** Where the recorder is writing. */
  uri: string;
  /** ISO time the rep pressed Record. */
  startedAt: string;
  /** Who was signed in when it started, if anyone. */
  userId: string | null;
  /** The name the rep had already typed, if they typed one before starting. */
  label: string | null;
};

/** Written the moment recording starts, before a single second is captured. */
export async function markRecordingStarted(marker: InFlightMarker): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(marker));
  } catch {
    // Failing to write the marker must not stop the rep recording. It means only
    // that an interrupted call would not be recoverable — which is exactly the
    // situation before this existed, so it is a lost safety net, not a new fault.
  }
}

/** Cleared on a clean stop, and after a recovery attempt has been made. */
export async function clearRecordingStarted(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* a stale marker is handled: recovery checks the file before trusting it */
  }
}

export async function readMarker(): Promise<InFlightMarker | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.uri !== 'string' || typeof parsed.startedAt !== 'string') {
      return null;
    }
    return {
      uri: parsed.uri,
      startedAt: parsed.startedAt,
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      label: typeof parsed.label === 'string' ? parsed.label : null,
    };
  } catch {
    return null;
  }
}

export type Recovery =
  /** Nothing was interrupted. The ordinary case, and it says nothing to anyone. */
  | { kind: 'none' }
  /** A call was interrupted and its audio was saved. */
  | { kind: 'recovered'; recording: PendingRecording; startedAt: string }
  /**
   * A call was interrupted and the audio is gone — the OS reclaimed the cache
   * before the app came back. Surfaced rather than swallowed: this is the one
   * outcome the rep can act on, by re-recording while they still remember the
   * conversation.
   */
  | { kind: 'lost'; startedAt: string }
  /**
   * A call was interrupted, the audio still appears to be there, and securing it
   * failed this time. Distinct from 'lost' on purpose: the marker is KEPT and the
   * next launch tries again, so telling the rep the call is gone would be wrong —
   * and telling them nothing would be worse, because they would not know to stop
   * clearing storage or to plug the phone in before reopening the app.
   */
  | { kind: 'deferred'; startedAt: string };

/**
 * Called once at launch. Recovers the audio of a call that never got to stop.
 *
 * The marker is cleared on both outcomes the rep can do nothing more about: the
 * audio was saved, or the audio is gone. A marker that survived a confirmed loss
 * would report the same dead call at every launch from now on. It is KEPT only
 * when the file is still there and securing it failed — that is worth another
 * attempt, and one bad moment is not a reason to write a call off.
 */
export async function recoverInterruptedRecording(userId: string | null): Promise<Recovery> {
  const marker = await readMarker();
  if (!marker) return { kind: 'none' };

  try {
    const source = new File(marker.uri);
    // Zero bytes counts as gone. The recorder creates the file before it has
    // written anything, so an empty one means the app died in the first moment —
    // there is no call in it, and offering the rep an empty recording to send
    // would be worse than telling them plainly that nothing was captured.
    if (!source.exists || (source.size ?? 0) === 0) {
      await clearRecordingStarted();
      return { kind: 'lost', startedAt: marker.startedAt };
    }

    // The same path a clean Stop takes — the move into documents, the size read
    // from the file that actually exists, the store write before any network.
    // Deliberately not a second implementation: a recovery path that saved
    // recordings slightly differently is one that would be exercised only in the
    // rare case and therefore only be found broken then.
    const recording = await persistRecording({
      // Whoever is signed in NOW owns it. A call recorded under a previous
      // sign-in goes to the unclaimed bucket and is claimed at the next sign-in,
      // which is the rule the rest of this app already follows.
      userId,
      sourceUri: marker.uri,
      // Unknown, and left unknown. See the header.
      durationMs: 0,
      label: marker.label,
    });
    await clearRecordingStarted();
    return { kind: 'recovered', recording, startedAt: marker.startedAt };
  } catch {
    // persistRecording throws when the file cannot be secured. The audio may
    // still be sitting there, so the marker is NOT cleared — the next launch
    // tries again rather than writing the call off after one bad moment.
    return { kind: 'deferred', startedAt: marker.startedAt };
  }
}
