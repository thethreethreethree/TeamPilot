/**
 * The sweep that gets a day of doors to the server.
 *
 * SEPARATE FROM THE HOOK, and by now this is a stated rule rather than a
 * discovery: in this project, pure decision logic lives apart from anything that
 * imports React Native or the network, because the test runner strips types and
 * cannot load a native module. Six modules have been split this way. The cost is
 * one file; what it buys is that the rules which decide whether a rep's work
 * survives are actually exercised.
 *
 * WHAT IS DECIDED HERE, and why each rule is the way round it is:
 *
 *   - A CONFIRMED knock leaves the queue, and only that one.
 *   - A 401-CLASS failure stops the WHOLE sweep. Every other knock hits the same
 *     wall, and pushing on would spend every door's attempts against a backend
 *     that is not deployed — after which they would stop being retried at all,
 *     permanently, for a reason no rep could see.
 *   - A TRANSIENT failure stops the sweep too: a dead connection says everything
 *     about the next second and nothing about the next knock.
 *   - A REJECTION does NOT stop it: the server understood this one body and
 *     refused it, which says nothing about the next. Stopping would let one
 *     malformed knock hold up a whole street.
 *
 * Nothing here ever deletes a knock it did not get a confirmation for. Giving up
 * on sending is not the same as throwing away a door.
 */
import { listKnocks, markKnockFailed, removeKnock, type Knock } from './knock-store';
import type { KnockSend } from './door-log-api';

/**
 * How a knock is actually sent. Injected rather than imported, the same way the
 * recording sender and the write queue do it, and for the same two reasons that
 * point the same way:
 *
 *   - deciding WHETHER and IN WHAT ORDER to send is a different job from knowing
 *     how, and the ordering rules here are the part worth testing — a knock that
 *     quietly stops being retried looks exactly like one that worked;
 *   - importing the real sender statically pulls the HTTP client in behind it,
 *     which cannot load under this project's test runner at all.
 */
export type KnockSender = (knock: Knock) => Promise<KnockSend>;

/** The real one, loaded only when there is something to send. */
const defaultSender: KnockSender = async (knock) => {
  const { sendKnock } = await import('./door-log-api');
  return sendKnock(knock);
};

/** Never two sweeps at once, and never one straight after another. */
const COOLDOWN_MS = 5_000;

/** Give up on one knock after this many automatic tries; it is still kept. */
export const MAX_KNOCK_ATTEMPTS = 8;

let running = false;
let lastRun = 0;
let stoppedUntilRestart = false;

export function knockSendingStopped(): boolean {
  return stoppedUntilRestart;
}

/** Test seam and the manual-retry path. */
export function resetKnockSending(): void {
  running = false;
  lastRun = 0;
  stoppedUntilRestart = false;
}

export async function runKnockSend(
  userId: string,
  options: { force?: boolean; now?: number; send?: KnockSender } = {},
): Promise<{ sent: number; skipped: boolean }> {
  const send = options.send ?? defaultSender;
  const now = options.now ?? Date.now();
  if (running) return { sent: 0, skipped: true };
  if (stoppedUntilRestart) return { sent: 0, skipped: true };
  if (!options.force && now - lastRun < COOLDOWN_MS) return { sent: 0, skipped: true };

  running = true;
  lastRun = now;
  let sent = 0;
  try {
    const queue = (await listKnocks(userId)).filter((k) => k.attempts < MAX_KNOCK_ATTEMPTS);
    for (const knock of queue) {
      const result = await send(knock);
      if (result.ok) {
        await removeKnock(userId, knock.clientKnockId);
        sent++;
        continue;
      }
      if (result.reason === 'needs-shim') {
        // Every other knock hits the same wall. Stop rather than counting a
        // failed attempt against a whole day's doors.
        stoppedUntilRestart = true;
        break;
      }
      if (result.reason === 'rejected') {
        // Permanent for this one, and says nothing about the next.
        await markKnockFailed(userId, knock.clientKnockId, result.message);
        continue;
      }
      // Transient: the connection is bad now. Stop and let the next sweep try.
      await markKnockFailed(userId, knock.clientKnockId, result.message);
      break;
    }
    return { sent, skipped: false };
  } finally {
    running = false;
  }
}

