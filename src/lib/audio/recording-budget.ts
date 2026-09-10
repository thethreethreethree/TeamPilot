/**
 * How much recording fits — in bytes, in seconds, and on this phone's disk.
 *
 * WHY THIS IS NOT IN `capture.ts`. The arithmetic here answers one question:
 * "will this call survive?" — will the server accept the file, and is there room
 * on the device to write it. Both failures land AFTER the conversation is over,
 * when the recording can no longer be re-taken, which makes them the least
 * forgiving errors in the app.
 *
 * `capture.ts` imports `expo-audio` and `expo-file-system`, so every one of
 * those sums was reachable only from a device. That is precisely backwards: the
 * arithmetic that decides whether a rep loses a call was the part that could not
 * be checked without risking one. The native reads stay in `capture.ts`; the
 * sums live here with no imports, so they can be proven.
 *
 * `capture.ts` re-exports all of this, so existing importers are unaffected.
 */
import { CALL_BIT_RATE } from './recording-format';

/** The server's own ceiling, read from TeamPilot's `AGENT_MAX_BYTES` rather than guessed. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Headroom demanded on top of the recording itself.
 *
 * The OS needs somewhere to work, and a phone that is completely full misbehaves
 * in ways that have nothing to do with this app.
 */
export const DISK_HEADROOM_BYTES = 50 * 1024 * 1024;

/** Bytes one second of this format costs. The single place the division happens. */
export const BYTES_PER_SECOND = CALL_BIT_RATE / 8;

/** The server's ceiling expressed as recording time, for telling the rep up front. */
export const MAX_RECORDING_SECONDS = Math.floor(MAX_UPLOAD_BYTES / BYTES_PER_SECOND);

/**
 * Roughly how long the device can still record, given the server's ceiling.
 *
 * Never negative: a recording already over the ceiling has no time left, and a
 * negative countdown on screen would read as time gained.
 */
export function remainingSecondsForSize(bytesSoFar: number): number {
  if (!Number.isFinite(bytesSoFar)) return 0;
  return Math.max(0, Math.floor((MAX_UPLOAD_BYTES - bytesSoFar) / BYTES_PER_SECOND));
}

export type DiskBudget = {
  ok: boolean;
  availableBytes: number | null;
  /** Roughly how many minutes fit, when space is the limit rather than the
   *  server's ceiling. Null when the figure could not be read. */
  minutesAvailable: number | null;
};

/**
 * The disk verdict, given a figure the caller has already read from the device.
 *
 * AN UNREADABLE FIGURE IS `ok: true`, NOT `ok: false`. Not knowing how much
 * space there is is not a reason to refuse to record — the rep's call matters
 * more than our certainty, and blocking on an unread number would silently
 * disable recording on any platform that does not report disk space.
 */
export function diskBudget(availableBytes: number | null): DiskBudget {
  if (typeof availableBytes !== 'number' || !Number.isFinite(availableBytes)) {
    return { ok: true, availableBytes: null, minutesAvailable: null };
  }
  const usable = Math.max(0, availableBytes - DISK_HEADROOM_BYTES);
  return {
    ok: availableBytes >= MAX_UPLOAD_BYTES + DISK_HEADROOM_BYTES,
    availableBytes,
    minutesAvailable: Math.floor(usable / BYTES_PER_SECOND / 60),
  };
}

export type Sendability =
  | { sendable: true }
  /** Over the server's ceiling. `overMb` is what to tell the rep. */
  | { sendable: false; reason: 'too-large'; overMb: number }
  /** The size was never read. Not a verdict — see below. */
  | { sendable: true; unknownSize: true };

/**
 * Whether a recording can be sent at all, decided BEFORE the rep taps Send.
 *
 * The upload path already refuses an oversize file, but only at the moment of
 * sending. On the recordings list — the screen whose whole job is showing a rep
 * that nothing has been lost — a file that can never leave the phone is the one
 * thing they most need to see, and they were finding out by tapping Send and
 * reading an error.
 *
 * AN UNREAD SIZE IS TREATED AS SENDABLE. The same posture as the disk check: not
 * knowing is not a verdict, and marking a recording unsendable on a figure we
 * failed to read would tell a rep their call is lost when it is fine. The server
 * is the authority; this only warns where it is certain.
 */
export function sendability(sizeBytes: number | null | undefined): Sendability {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { sendable: true, unknownSize: true };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      sendable: false,
      reason: 'too-large',
      // Rounded UP: "0 MB over" would read as a rounding quibble rather than a
      // real limit, and a rep needs to know it is genuinely over.
      overMb: Math.max(1, Math.ceil((sizeBytes - MAX_UPLOAD_BYTES) / 1024 / 1024)),
    };
  }
  return { sendable: true };
}

/**
 * The byte count as the sign route will accept it.
 *
 * The route's schema is `z.number().int().nonnegative()`, so a fractional or
 * non-finite size is rejected outright — a 400 on the one request that stands
 * between a rep and their recording being saved.
 *
 * The value originates in a NATIVE filesystem call, and I cannot observe what
 * that returns from here. This is therefore a guard against something
 * unverified rather than something seen to fail: rounding costs nothing, and
 * the alternative is a recording that can never be sent and no obvious reason
 * why. Rounds DOWN, so a claimed size is never larger than the file.
 */
export function sizeForUpload(sizeBytes: number | null | undefined): number {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) return 0;
  return Math.floor(sizeBytes);
}
