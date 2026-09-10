/**
 * A durable queue for the writes a rep makes when the network is not there.
 *
 * THE PROBLEM IT SOLVES. A rep finishes a call in a stairwell, taps
 * "Sold · £4,500", and the request fails. Until now the screen said "try again
 * when you have signal" and that was the end of it: the number existed only in
 * the rep's head, at the exact moment they were walking into the next
 * appointment. The outcome of a call is the single most valuable thing this app
 * collects — it is what every figure on the numbers screen is computed from —
 * and it was the thing most likely to be lost, because it is recorded in the
 * ninety seconds between two doors, which is also when the signal is worst.
 *
 * So the write is kept. The rep's instruction survives the failure, survives the
 * app being killed, and is sent when there is a network, without anyone having
 * to remember.
 *
 * WHAT IT HOLDS, AND WHAT IT DELIBERATELY DOES NOT. Only writes that SET A
 * STATE: the call's outcome (with its deal value) and the call's name. Both are
 * idempotent — sending the same one twice leaves the server in the state the rep
 * asked for. Nothing that APPENDS goes in here. Recordings have their own queue
 * (recording-store + auto-send) because a multi-megabyte file needs different
 * handling from a hundred-byte instruction, and speaker attribution has its own
 * (attribution-store) because it is a question waiting on an answer rather than
 * an answer waiting on a network.
 *
 * WHY REPLACING, NOT APPENDING. A rep who marks a call "No sale", then reopens it
 * and marks it "Sold", has changed their mind — not made two requests. Queuing both
 * would send "No sale" first and briefly publish a wrong outcome to a manager's team
 * screen. So a new instruction for the same call and the same field REPLACES the
 * one waiting, in place: the queue holds intentions, not history.
 *
 * WHY IT KEEPS ITS PLACE WHEN REPLACED. The replacement takes the old entry's
 * position rather than going to the back. Otherwise a rep who keeps adjusting one
 * call's value pushes it behind everything else forever, and the write they are
 * most actively thinking about is the last to land.
 *
 * NEVER SILENTLY DROPPED. The build plan is explicit — "surface conflicts, never
 * silently drop". An entry the server refuses stays in the queue with the reason
 * attached, and the screen shows it. A write that vanished quietly would be
 * worse than one that never left: the rep would believe it landed.
 *
 * WHY AsyncStorage. The read cache's own note defers the outbox to this phase
 * and points at SQLite for "ordering and replay guarantees a key-value store
 * cannot give". Ordering is in the array and replay is in runOutbox, so what
 * SQLite would actually add here is atomicity across concurrent writers — and
 * there is one writer. What it would cost is a schema and a migration path for a
 * queue that holds a handful of hundred-byte rows. The honest limit of this
 * choice: a crash mid-write loses the LAST enqueue, because AsyncStorage
 * replaces a key whole. It cannot corrupt or lose the rest of the queue.
 *
 * NOTHING SECRET IS STORED. An outcome and a customer's name are the rep's own
 * data, already on their screen. The access token is not here — it lives in the
 * Keychain (secure-session-store.ts) and is fetched at send time. The queue is
 * keyed per user, so on a shared phone one rep's queue is invisible to the next
 * — and unlike every cache here it SURVIVES sign-out, because it holds the only
 * copy of an instruction rather than a copy of something the server already has
 * (see clearOutbox).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionOutcome } from '@/types/backend';
import type { SendOutcome } from './outbox-classify';
import { recordCrash } from '../crash-log-store';
import { noteFor, shouldRecord, subjectOfKind, whereFor } from '../crash-notable';

export type { SendOutcome };

const keyFor = (userId: string) => `outbox.v1.${userId}`;

/** Stop retrying one entry automatically after this many attempts. The rep can
 *  still send it by hand; this caps only the unattended tries, so a permanently
 *  failing write does not spend a working day's battery on the same request. */
export const MAX_OUTBOX_ATTEMPTS = 5;

/** Never start another sweep within this window. Signal at the edge of coverage
 *  comes and goes every few seconds, and each flap would otherwise start a run. */
const COOLDOWN_MS = 30_000;

/**
 * How long an unsent write is kept.
 *
 * Longer than the session list's week, and deliberately so: a queued outcome is
 * the rep's own instruction, not a copy of something the server already has, and
 * throwing one away because it is old destroys the only record of it. Thirty days
 * is past any plausible "the backend was not switched on yet" gap. Past that, a
 * write has stopped being a pending action and become an archaeological one — and
 * the caller is handed what was dropped so it can be said out loud rather than
 * disappearing.
 */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type OutboxKind = 'outcome' | 'rename';

/** Why an entry is not being retried automatically any more. Never a reason to
 *  delete it — only a reason to stop spending network on it, and to say so. */
export type OutboxBlock = 'needs-shim' | 'rejected' | 'conflict' | 'attempts';

export type OutboxEntry = {
  /** Stable id, used as the list key and to remove exactly one entry. */
  id: string;
  sessionId: string;
  kind: OutboxKind;
  /** For 'outcome'. `dealValue` absent means "leave it alone"; null means
   *  "clear it" — different instructions the server treats differently, so the
   *  distinction is carried through the queue rather than flattened by a default. */
  outcome?: SessionOutcome;
  dealValue?: number | null;
  /** For 'rename'. */
  clientLabel?: string;
  /** When the rep gave this instruction. */
  queuedAt: string;
  attempts: number;
  lastError?: string;
  blocked?: OutboxBlock;
};

async function readAll(userId: string): Promise<OutboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        Boolean(e) &&
        typeof e.id === 'string' &&
        typeof e.sessionId === 'string' &&
        typeof e.queuedAt === 'string' &&
        (e.kind === 'outcome' || e.kind === 'rename'),
    );
  } catch {
    // A corrupt queue is not something a rep can act on, and refusing to read it
    // would break every write from here on. Treat it as empty and move on.
    return [];
  }
}

async function writeAll(userId: string, entries: OutboxEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(entries));
  } catch {
    // Failing to persist must not fail the tap the rep just made. The screen's
    // own state already reflects it; it will simply not survive a relaunch, and
    // the caller reports the write as unsent either way.
  }
}

/** Entries too old to still be pending actions. Returned rather than deleted in
 *  place, so whoever drops them can say what went. */
export function expired(entries: OutboxEntry[], now = Date.now()): OutboxEntry[] {
  return entries.filter((e) => {
    const t = new Date(e.queuedAt).getTime();
    return Number.isFinite(t) && now - t > MAX_AGE_MS;
  });
}

/**
 * Queue a write, replacing any instruction still waiting for the same call and
 * the same field.
 *
 * Attempts reset on replace. The rep has just re-stated what they want, which is
 * new intent rather than a retry of the old one, and it deserves a fresh run at
 * the network — a queue that inherited four failed attempts would refuse to send
 * the correction on its first try.
 *
 * THE REPLACEMENT TAKES A NEW ID, and that is load-bearing rather than
 * incidental. The id is how a completed send identifies what it just sent. If a
 * replacement inherited the old id, an older instruction confirmed by the server
 * would find the NEWER one under that id and delete it — the rep's correction
 * would vanish with nothing recording that it ever existed. Timestamps cannot
 * stand in for this: two enqueues in the same millisecond produce the same
 * `queuedAt`, which is exactly the case a rep correcting a tap generates.
 */
/**
 * A new id for every instruction.
 *
 * The clock alone is not enough: a rep correcting a tap enqueues twice inside
 * the same millisecond, `Date.now()` returns the same number, and the
 * replacement would take the id of the instruction currently in flight — the
 * exact collision the new id exists to prevent. The counter makes two ids in the
 * same millisecond impossible; the clock keeps them readable and ordered in a
 * log.
 */
let seq = 0;
function nextId(kind: OutboxKind, sessionId: string): string {
  return `${kind}:${sessionId}:${Date.now()}:${++seq}`;
}

export async function enqueue(
  userId: string,
  entry: Omit<OutboxEntry, 'id' | 'queuedAt' | 'attempts'> & { id?: string },
): Promise<OutboxEntry> {
  const entries = await readAll(userId);
  const at = entries.findIndex((e) => e.sessionId === entry.sessionId && e.kind === entry.kind);
  const next: OutboxEntry = {
    ...entry,
    id: entry.id ?? nextId(entry.kind, entry.sessionId),
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: undefined,
    blocked: undefined,
  };
  if (at >= 0) entries[at] = next;
  else entries.push(next);
  await writeAll(userId, entries);
  return next;
}

/** Everything waiting, oldest first — the order it will be sent in. */
export async function listOutbox(userId: string): Promise<OutboxEntry[]> {
  return readAll(userId);
}

/**
 * What is waiting for ONE call.
 *
 * The session screen uses this to label a value as not yet sent. A queued
 * outcome shown as though the server already had it is the lie this whole module
 * exists to avoid — the rep would walk into a pipeline review quoting a number
 * their manager cannot see.
 */
export async function pendingFor(userId: string, sessionId: string): Promise<OutboxEntry[]> {
  return (await readAll(userId)).filter((e) => e.sessionId === sessionId);
}

/** Remove one entry — used when it lands, and when the rep chooses to discard it. */
export async function removeEntry(userId: string, id: string): Promise<void> {
  const entries = await readAll(userId);
  await writeAll(
    userId,
    entries.filter((e) => e.id !== id),
  );
}

/**
 * Throw the whole queue away.
 *
 * NOT called on sign-out, and that is a deliberate difference from every other
 * on-device store here. The caches hold copies of things the server already has,
 * so sweeping them on sign-out costs nothing and stops one rep's data reaching
 * the next person to hold the phone. A queued write is the OPPOSITE: it is the
 * only copy of an instruction that exists anywhere, and deleting it destroys
 * data rather than tidying it. It also cannot leak — the queue is keyed per
 * user and the sweep runs under the signed-in user's own id, so a previous rep's
 * outcomes can never be sent by, or shown to, whoever signs in next. Recordings
 * are kept across sign-out for the same reason; this follows them.
 *
 * So this exists for a rep who deliberately discards everything waiting. Nothing
 * calls it automatically.
 */
export async function clearOutbox(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}

/** True when this entry will not be retried without the rep asking. */
export function stalled(e: OutboxEntry): boolean {
  return Boolean(e.blocked) || e.attempts >= MAX_OUTBOX_ATTEMPTS;
}

// ---------------------------------------------------------------- sending

/**
 * How an entry is actually sent. Injected for the same reason the recording
 * sender is: deciding WHETHER and IN WHAT ORDER to send is a different job from
 * knowing how, and this module should be readable and testable without loading
 * the HTTP client and the auth SDK behind it.
 */
export type OutboxSender = (entry: OutboxEntry) => Promise<SendOutcome>;

/** The real one, imported only when it is actually needed. */
const defaultSender: OutboxSender = async (entry) => {
  const { sendOutboxEntry } = await import('./outbox-send');
  return sendOutboxEntry(entry);
};

let lastRun = 0;
let running = false;
/** Set when the server has told us it does not accept these writes from the app
 *  at all. Cleared only by a restart, or by a manual send that actually works. */
let stoppedUntilRestart = false;

export type OutboxRunResult = {
  attempted: number;
  sent: number;
  /** Entries that came back with a reason retrying cannot fix. Still queued. */
  blocked: number;
  /** Entries dropped for age, so the caller can tell the rep what went. */
  dropped: OutboxEntry[];
  skipped: boolean;
  reason?: 'cooldown' | 'already-running' | 'stopped' | 'nothing-to-send';
};

/**
 * Send everything that is ready. Safe to call often — it decides for itself
 * whether to do anything.
 *
 * One at a time, in queue order. These are small requests, but they go out over
 * a connection that has just come back, and a burst of six is how all six fail
 * and every entry spends an attempt for nothing.
 */
export async function runOutbox(
  userId: string,
  options: { force?: boolean; send?: OutboxSender; now?: number } = {},
): Promise<OutboxRunResult> {
  const send = options.send ?? defaultSender;
  const now = options.now ?? Date.now();
  const idle = { attempted: 0, sent: 0, blocked: 0, dropped: [] as OutboxEntry[], skipped: true };

  if (running) return { ...idle, reason: 'already-running' };
  // Deliberately before the force check and not overridable by it. `force` means
  // "skip the cooldown"; it never means "ignore that the server is refusing these".
  if (stoppedUntilRestart) return { ...idle, reason: 'stopped' };
  if (!options.force && now - lastRun < COOLDOWN_MS) return { ...idle, reason: 'cooldown' };

  running = true;
  lastRun = now;
  let attempted = 0;
  let sent = 0;
  let blocked = 0;

  try {
    let entries = await readAll(userId);

    // Age out first, and report what went. Done before the sweep so a month-old
    // entry does not spend an attempt on its way to being discarded.
    const dropped = expired(entries, now);
    if (dropped.length > 0) {
      entries = entries.filter((e) => !dropped.includes(e));
      await writeAll(userId, entries);
    }

    const queue = entries.filter((e) => !stalled(e));
    if (queue.length === 0) {
      return {
        attempted: 0,
        sent: 0,
        blocked: 0,
        dropped,
        skipped: true,
        reason: 'nothing-to-send',
      };
    }

    for (const entry of queue) {
      attempted++;
      const result = await send(entry);

      // Re-read rather than mutating the snapshot: the rep may have changed this
      // outcome while the request was in flight, and their newer instruction must
      // win over a stale copy taken before it existed. A replacement carries a
      // NEW id, so an entry that is no longer here by id is one that has been
      // superseded — and nothing about the request just sent applies to it.
      const live = await readAll(userId);
      const at = live.findIndex((e) => e.id === entry.id);
      const current = at >= 0 ? live[at] : null;

      /**
       * A TERMINAL FAILURE LEAVES A TRACE THE REP CAN SEND.
       *
       * Before this, a server that refused every knock produced exactly one
       * visible thing: a sentence on the session row. The outbox retried
       * forever, the rep shrugged, and nobody who could deploy the fix ever
       * learned it was happening. `shouldRecord` keeps this to the failures a
       * retry cannot cure — a dead connection, which is the normal condition of
       * this job, never reaches the log.
       *
       * Fire and forget: a sweep runs in the background and must not slow down
       * for storage. Repeats of the identical failure collapse into one row.
       */
      if (!result.ok && shouldRecord(result)) {
        const subject = subjectOfKind(entry.kind);
        void recordCrash(new Error(noteFor(result, subject)), whereFor(subject));
      }

      if (result.ok) {
        sent++;
        // Only remove what was actually sent. A replacement queued mid-flight is
        // a DIFFERENT instruction and has not been sent — removing it here would
        // silently discard the correction the rep just made.
        if (current) {
          live.splice(at, 1);
          await writeAll(userId, live);
        }
        continue;
      }

      if (current) {
        live[at] = {
          ...current,
          attempts: current.attempts + 1,
          lastError: result.message,
          blocked:
            result.reason === 'transient'
              ? current.attempts + 1 >= MAX_OUTBOX_ATTEMPTS
                ? 'attempts'
                : undefined
              : result.reason,
        };
        await writeAll(userId, live);
      }

      if (result.reason === 'needs-shim') {
        // Every other entry will hit the same wall. Stop rather than failing each
        // one in turn and counting an attempt against all of them.
        stoppedUntilRestart = true;
        blocked++;
        break;
      }
      if (result.reason === 'rejected' || result.reason === 'conflict') {
        // Permanent for this entry, and says nothing about the next one.
        blocked++;
        continue;
      }
      // Transient: the connection is bad right now. Pushing on through it only
      // spends attempts on writes that would have worked in a minute.
      break;
    }

    return { attempted, sent, blocked, dropped, skipped: false };
  } finally {
    running = false;
  }
}

/** Called when a write goes through by hand — proof the server is accepting
 *  these again, so automatic sending can resume without a restart. */
export function clearOutboxStop(): void {
  stoppedUntilRestart = false;
}

/** True when the sweep has given up until the app restarts. */
export function outboxStopped(): boolean {
  return stoppedUntilRestart;
}

/** Test seam. Module-level state would otherwise leak between cases. */
export function __resetOutbox(): void {
  lastRun = 0;
  running = false;
  stoppedUntilRestart = false;
}
