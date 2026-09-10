/**
 * Sending recordings on its own, so a rep never has to remember to.
 *
 * THE PROBLEM IT SOLVES. Until now a recording sat on the phone until someone
 * opened "Waiting to send" and pressed Send on each one. A rep who records four
 * calls in a dead zone and then drives back into signal has four recordings that
 * will sit there indefinitely, because the moment they had signal they were
 * doing something else. Anything that depends on a person remembering, at the
 * exact moment they are busiest, is a feature that quietly does not work.
 *
 * WHAT IT WILL AND WILL NOT SEND. Only recordings that already carry a name.
 * The server files a call under the customer it belongs to, and the app has no
 * honest way to invent that — so naming a recording IS the rep's instruction to
 * send it, and an unnamed one waits. That also means auto-send can never
 * surprise someone by uploading a conversation they had not decided to keep.
 *
 * WHY IT BACKS OFF, AND WHY IT STOPS. Retrying a failing upload in a loop on a
 * phone is a way to flatten a battery and burn a data allowance during exactly
 * the working day the rep needs both. So: a cooldown between runs, a cap on
 * attempts per recording, and a hard stop on the one failure that retrying
 * cannot fix — a 401, which means the server does not accept mobile tokens yet.
 * Hammering it would not deploy the shim any sooner.
 *
 * IT NEVER DELETES ANYTHING ON FAILURE. A recording that will not send stays
 * exactly where it is, with the reason recorded, and the rep can still send it
 * by hand. Giving up is not the same as throwing away.
 */
import { listRecordings, uploaderFor, type PendingRecording } from './recording-store';
import { sendability } from './recording-budget';
import type { UploadOutcome } from './upload';
import { recordCrash } from '../crash-log-store';
import { shouldRecordUpload, uploadNoteFor } from '../crash-notable';

/**
 * How a recording is actually sent. Injected rather than imported, for two
 * reasons that point the same way:
 *
 *   - deciding WHETHER to send is a different job from knowing HOW, and this
 *     module should be readable and testable without dragging in the filesystem,
 *     the HTTP client and the storage SDK behind it;
 *   - statically importing the uploader would load a chain of native modules the
 *     moment anything touched this file, including a test that only wants to
 *     check the backoff rules.
 */
export type Sender = (
  userId: string,
  rec: PendingRecording,
  meta: { clientLabel: string },
) => Promise<UploadOutcome>;

/**
 * The real one, loaded only when it is actually needed.
 *
 * BRANCHES ON THE PIPELINE, and this is the whole reason the marker exists. A
 * `session` becomes a coaching session; a `pitch` goes to the door-log route,
 * which creates a knock AND a pitch so it counts toward doors knocked and shows
 * in Pitch Performance. Sending one down the other's path is how a rep records
 * a pitch and never finds it — the mistake this corrects.
 *
 * `recordingKind` is used rather than `rec.kind`, so a recording saved before
 * the marker existed is still treated as the session it is.
 */
const defaultSender: Sender = async (userId, rec, meta) => {
  if (uploaderFor(rec) === 'door-log') {
    const { sendPitchRecording } = await import('@/lib/doors/pitch-send');
    return sendPitchRecording(rec, meta);
  }
  const { uploadRecording } = await import('./upload');
  return uploadRecording(userId, rec, meta);
};

/** Stop retrying one recording after this many automatic attempts. The rep can
 *  still send it by hand — this only caps the UNATTENDED tries.
 *
 *  Exported because the screen has to be able to SAY when a recording has passed
 *  it. A recording that quietly stops being included, with nothing on screen
 *  explaining why, is one a rep believes is still on its way. */
export const MAX_AUTO_ATTEMPTS = 4;

/** True when automatic sending has given up on this one and only a manual send
 *  will move it. */
export function autoSendGaveUp(rec: PendingRecording): boolean {
  return rec.status !== 'uploaded' && rec.attempts >= MAX_AUTO_ATTEMPTS;
}

/** Never start another sweep within this window, however many times the network
 *  flaps. Signal at the edge of coverage comes and goes every few seconds. */
const COOLDOWN_MS = 60_000;

let lastRun = 0;
let running = false;
/** Set when the server has told us it cannot accept mobile tokens. Cleared only
 *  by a manual send succeeding, or by the app restarting. */
let stoppedUntilRestart = false;

export type AutoSendResult = {
  attempted: number;
  sent: number;
  /** True when the sweep was skipped rather than run. */
  skipped: boolean;
  reason?: 'cooldown' | 'already-running' | 'stopped' | 'nothing-to-send';
};

/**
 * A recording auto-send is allowed to touch.
 *
 * Exported so a screen offering "send all" counts by the SAME rule the sender
 * applies. Two copies of this condition would drift, and the first sign would be
 * a button promising to send three recordings and sending none.
 */
export function isSendable(rec: PendingRecording): boolean {
  if (rec.status === 'uploaded') return false;
  // No name means the rep has not said to send it yet.
  if (!rec.label || !rec.label.trim()) return false;
  if (rec.attempts >= MAX_AUTO_ATTEMPTS) return false;
  // The server refuses anything over its ceiling, and the upload path returns
  // BEFORE counting an attempt — so an oversize recording never ages out. It
  // would be re-selected by every sweep for the life of the app, and counted in
  // "Send all 3 now" when only two of the three can go. The recordings screen
  // says plainly why this one cannot.
  if (!sendability(rec.sizeBytes).sendable) return false;
  return true;
}

/**
 * Try to send everything that is ready. Safe to call often — it decides for
 * itself whether to do anything.
 *
 * Sends one at a time on purpose. These are multi-megabyte uploads over a
 * connection that has just come back; three at once is how all three fail.
 */
export async function runAutoSend(
  userId: string,
  options: { force?: boolean; send?: Sender } = {},
): Promise<AutoSendResult> {
  const send = options.send ?? defaultSender;
  if (running) return { attempted: 0, sent: 0, skipped: true, reason: 'already-running' };
  // Deliberately BEFORE the force check, and not overridable by it. `force`
  // means "skip the cooldown"; it does not mean "ignore that the server is
  // refusing these". Only clearAutoSendStop() lifts this, and only a manual send
  // that actually worked calls it — evidence, rather than optimism.
  if (stoppedUntilRestart) {
    return { attempted: 0, sent: 0, skipped: true, reason: 'stopped' };
  }
  if (!options.force && Date.now() - lastRun < COOLDOWN_MS) {
    return { attempted: 0, sent: 0, skipped: true, reason: 'cooldown' };
  }

  running = true;
  lastRun = Date.now();
  let attempted = 0;
  let sent = 0;

  try {
    // Read once, up front. A recording added mid-sweep is caught by the next
    // one, which is better than a list that changes while it is walked.
    const queue = (await listRecordings(userId)).filter(isSendable);
    if (queue.length === 0) {
      return { attempted: 0, sent: 0, skipped: true, reason: 'nothing-to-send' };
    }

    // Oldest first: the call a rep is most likely to have forgotten is the one
    // that has been waiting longest.
    for (const rec of [...queue].reverse()) {
      attempted++;
      const result = await send(userId, rec, { clientLabel: rec.label! });

      /**
       * A RECORDING THAT CAN NEVER BE SENT LEAVES A TRACE.
       *
       * `file-gone` in particular is the worst outcome this app has — the only
       * copy of a real conversation, lost — and until now it produced a line on
       * a screen and nothing else. Ordinary failures and not-ready pitches are
       * excluded: the first is a dead zone, the second is the rep's own to
       * finish, and recording either would fill the log with noise.
       */
      if (!result.ok && shouldRecordUpload(result.reason)) {
        void recordCrash(
          new Error(uploadNoteFor(result.reason, rec.label ?? null)),
          'Sending a recording',
        );
      }

      if (result.ok) {
        sent++;
        continue;
      }
      if (result.reason === 'needs-shim') {
        // Every other recording will hit the same wall. Stop the sweep rather
        // than failing each one in turn and counting four attempts against them.
        stoppedUntilRestart = true;
        break;
      }
      if (
        result.reason === 'too-large' ||
        result.reason === 'file-gone' ||
        result.reason === 'not-ready'
      ) {
        // Permanent for this recording, but says nothing about the next one.
        // `not-ready` is a queued pitch with no outcome: it can never succeed,
        // so retrying it forever would spend attempts and hide the real reason.
        continue;
      }
      // A plain failure: stop here and let the next sweep try again. Pushing on
      // through a dead connection just spends attempts.
      break;
    }

    return { attempted, sent, skipped: false };
  } finally {
    running = false;
  }
}

/**
 * Called when a rep sends one by hand and it works — proof the server is
 * accepting uploads again, so automatic sending can resume without a restart.
 */
export function clearAutoSendStop(): void {
  stoppedUntilRestart = false;
}

/** True when auto-send has given up until the app restarts. */
export function autoSendStopped(): boolean {
  return stoppedUntilRestart;
}

/** Test seam. Module-level state would otherwise leak between cases. */
export function __resetAutoSend(): void {
  lastRun = 0;
  running = false;
  stoppedUntilRestart = false;
}
