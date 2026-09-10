/**
 * The record of recordings that exist on this device and have not reached the
 * server yet.
 *
 * WHY THIS IS THE FIRST THING BUILT, BEFORE THE UPLOAD. A recording cannot be
 * re-taken. Every other piece of data in this app can be fetched again; a
 * conversation that happened at a door is gone the moment the file is. So the
 * file is written to durable storage and its existence is recorded BEFORE any
 * network call is attempted, and the record is only cleared once the server has
 * confirmed it has the audio. Losing a rep's call because the upload failed on
 * a stairwell is the one failure this feature cannot come back from.
 *
 * WHY NOT THE OUTBOX FROM PHASE 4. That outbox is for ordered, replayable
 * WRITES against the API. This is narrower and lands first because recording
 * needs it now: a set of files with a status each, no ordering requirement
 * between them (two calls can upload in either order without changing what the
 * server ends up holding).
 *
 * IDEMPOTENCY. Each entry carries a `clientId` generated once, at capture. The
 * plan's Phase 4 note is explicit that the backend has an append-only
 * double-write class, so a retry must be keyable to the same recording rather
 * than producing a second copy of the same call.
 *
 * WHAT IS NOT KEPT HERE. The audio itself lives on the filesystem; this holds
 * only its path and its bookkeeping. AsyncStorage is plaintext, so nothing
 * secret goes in it — and the recording's own path is not a secret, since the
 * file sits in this app's sandboxed documents directory.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionOutcome } from '@/types/backend';

const KEY_PREFIX = 'recordings.v1';

const keyFor = (userId: string) => `${KEY_PREFIX}.${userId}`;

/**
 * Where a recording goes when nobody is signed in.
 *
 * A rep's session can expire while they are mid-conversation. Refusing to save
 * the recording at that moment would destroy the one thing in this app that
 * cannot be recreated, in exchange for tidiness about which key it sits under.
 * So it is saved anyway, unattached, and claimed by whoever signs in next.
 *
 * That last part is safe because it can only ever be the same person: the file
 * was recorded on this phone, by whoever was holding it, seconds ago. It is not
 * a lost-and-found for other people's calls — anything older is left alone.
 */
const UNCLAIMED = '__unclaimed';

/** Recordings made while signed out are claimed only if they are this recent. */
const CLAIM_WINDOW_MS = 12 * 60 * 60 * 1000;

/** The key to save under. Null user means nobody was signed in. */
export const storeKeyFor = (userId: string | null) => userId ?? UNCLAIMED;

export type RecordingStatus =
  /** On the device, not yet sent. */
  | 'pending'
  /** Sent and confirmed by the server. Kept briefly so the UI can say so. */
  | 'uploaded'
  /** The last attempt failed. Still on the device; still retryable. */
  | 'failed';

export type PendingRecording = {
  /** Generated at capture and never regenerated — the idempotency key. */
  clientId: string;
  /**
   * WHICH PIPELINE this recording belongs to.
   *
   * The product has two, and they are not interchangeable. A `session` becomes a
   * `coaching_sessions` row and appears under Sessions. A `pitch` is posted to
   * the door-log route, which creates a knock AND a pitch — so it counts toward
   * doors knocked and appears in Pitch Performance. Sending one down the other's
   * path is how a rep records a pitch and never finds it.
   *
   * OPTIONAL, AND ABSENT MEANS `session`. Every recording made before this field
   * existed is a session, and a rep with unsent audio on their phone must not
   * lose it to an upgrade. Read it through `recordingKind()`, never directly.
   */
  kind?: 'session' | 'pitch';
  /**
   * For a `pitch` only: how it ended, the rep's local date, and the knock id.
   *
   * The outcome is the door vocabulary (four values — a recorded pitch cannot be
   * "no answer"), NOT the session vocabulary. They are different sets with one
   * word in common, which is exactly why they are separate fields.
   */
  pitchOutcome?: string | null;
  pitchLocalDate?: string | null;
  /** Absolute file:// path in this app's documents directory. */
  fileUri: string;
  /** Bytes, as measured on disk after the recording stopped. */
  sizeBytes: number;
  /** Milliseconds, as reported by the recorder. */
  durationMs: number;
  /** e.g. "audio/m4a" — what the sign route is told. */
  mimeType: string;
  /** ISO time the recording ended. */
  recordedAt: string;
  status: RecordingStatus;
  /** The session this belongs to, once the server has one. Null until then. */
  sessionId: string | null;
  /** What the rep called it, if anything. Their words, not generated. */
  label: string | null;
  /**
   * The call's context, exactly as the create-session route accepts it: WHERE it
   * happened, HOW it was approached, WHAT was offered.
   *
   * Optional, and it stays optional. A rep at a door will not fill in three
   * fields, and a recording that cannot be sent for want of them would be worse
   * than one filed with less detail. But a session created here without them is
   * thinner than the same session created on the website — and the KPI board
   * reads these — so the app has to at least OFFER them, or recording through
   * the phone quietly produces worse data than typing it up later.
   */
  territory: string | null;
  approach: string | null;
  offer: string | null;
  /**
   * How the call ended, and what it was worth.
   *
   * WHY THESE MATTER MORE THAN THE OTHER FIELDS. Conversion rate is sold divided
   * by opportunities; close rate is won divided by resolved; revenue comes from
   * deal value. A session with no outcome contributes to NONE of them. So a call
   * recorded through this app without one is a call that never reaches the
   * rep's own numbers — the board would sit at "building" indefinitely while
   * they made sale after sale.
   *
   * Still optional. A rep who does not know yet should not be forced to guess,
   * and "undecided" is a real answer the server accepts.
   */
  outcome: SessionOutcome | null;
  /** Major units, matching the numeric(14,2) column — 1500 means $1,500.00. */
  dealValue: number | null;
  /** The last failure, kept so the screen can say what went wrong. */
  lastError: string | null;
  attempts: number;
};

async function readAll(userId: string): Promise<PendingRecording[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A malformed entry is dropped rather than allowed to break the list, but a
    // VALID entry is never dropped for being unfamiliar.
    return parsed.filter(
      (r): r is PendingRecording =>
        r && typeof r.clientId === 'string' && typeof r.fileUri === 'string',
    );
  } catch {
    return [];
  }
}

async function writeAll(userId: string, rows: PendingRecording[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(rows));
}

/** Everything still on this device, newest first. */
export async function listRecordings(userId: string): Promise<PendingRecording[]> {
  const rows = await readAll(userId);
  return [...rows].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function countPending(userId: string): Promise<number> {
  return (await readAll(userId)).filter((r) => r.status !== 'uploaded').length;
}

/**
 * How many bytes of the phone unsent recordings are holding.
 *
 * The recorder refuses to start when the disk is nearly full and tells the rep
 * to free some space. Without this it cannot mention that a chunk of that space
 * is recordings this app is still holding — which is both the likeliest cause
 * and the one thing they can act on immediately.
 */
export async function pendingBytes(userId: string): Promise<number> {
  return (await readAll(userId))
    .filter((r) => r.status !== 'uploaded')
    .reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
}

/**
 * Record that a recording exists. Called the instant the file is on disk, before
 * anything is attempted over the network.
 *
 * This one does NOT swallow its errors. Everywhere else in the app a failed
 * cache write is a slower screen; here it is a call that nobody knows about, so
 * the caller has to be told and can warn the rep while the audio still exists.
 */
export async function addRecording(
  userId: string,
  entry: Omit<
    PendingRecording,
    | 'status'
    | 'lastError'
    | 'attempts'
    | 'sessionId'
    | 'territory'
    | 'approach'
    | 'offer'
    | 'outcome'
    | 'dealValue'
  > &
    Partial<
      Pick<
        PendingRecording,
        'sessionId' | 'label' | 'territory' | 'approach' | 'offer' | 'outcome' | 'dealValue'
      >
    >,
): Promise<PendingRecording> {
  const row: PendingRecording = {
    ...entry,
    // Defaults applied AFTER the spread, so an explicitly-passed undefined
    // becomes null rather than silently overwriting the default with undefined.
    sessionId: entry.sessionId ?? null,
    label: entry.label ?? null,
    territory: entry.territory ?? null,
    approach: entry.approach ?? null,
    offer: entry.offer ?? null,
    outcome: entry.outcome ?? null,
    dealValue: entry.dealValue ?? null,
    status: 'pending',
    lastError: null,
    attempts: 0,
  };
  const rows = await readAll(userId);
  // Re-adding the same clientId replaces rather than duplicates, so a retried
  // save cannot produce two entries for one call.
  const next = [...rows.filter((r) => r.clientId !== row.clientId), row];
  await writeAll(userId, next);
  return row;
}

export async function updateRecording(
  userId: string,
  clientId: string,
  patch: Partial<PendingRecording>,
): Promise<void> {
  try {
    const rows = await readAll(userId);
    const next = rows.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r));
    await writeAll(userId, next);
  } catch {
    // Bookkeeping only. The file and the recording itself are untouched.
  }
}

/**
 * Forget a recording. The CALLER deletes the file — this only removes the
 * bookkeeping, and doing it in that order means a crash between the two leaves
 * an orphaned file (wasted space, recoverable) rather than an orphaned entry
 * pointing at a file that no longer exists (a broken retry, forever).
 */
export async function removeRecording(userId: string, clientId: string): Promise<void> {
  try {
    const rows = await readAll(userId);
    await writeAll(userId, rows.filter((r) => r.clientId !== clientId));
  } catch {
    /* nothing to recover */
  }
}

/**
 * Called on sign-out.
 *
 * DELIBERATELY DIFFERENT FROM THE OTHER STORES. The caches are cleared because
 * they are stale copies of server data. A pending recording is NOT a copy of
 * anything — it is the only place that call exists. So this removes the
 * bookkeeping for the signed-out rep but reports what was still pending, and the
 * caller decides whether to warn before throwing away work that cannot be
 * recovered.
 */
export async function pendingAtSignOut(userId: string): Promise<PendingRecording[]> {
  return (await readAll(userId)).filter((r) => r.status !== 'uploaded');
}

/**
 * Attach any recordings made while signed out to the rep who just signed in.
 *
 * Called after a successful sign-in. Only recent ones are claimed: a phone that
 * has sat in a drawer for a week, then been handed to someone else, must not
 * hand them the previous person's conversation.
 *
 * Returns how many were claimed, so the screen can say so rather than have the
 * recordings appear from nowhere.
 */
export async function claimUnclaimedRecordings(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(UNCLAIMED));
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      await AsyncStorage.removeItem(keyFor(UNCLAIMED));
      return 0;
    }

    const cutoff = Date.now() - CLAIM_WINDOW_MS;
    const claimable: PendingRecording[] = [];
    const tooOld: PendingRecording[] = [];
    for (const r of parsed as PendingRecording[]) {
      if (!r || typeof r.clientId !== 'string') continue;
      const at = new Date(r.recordedAt).getTime();
      // An unreadable timestamp is treated as too old — never claimed on a guess.
      if (Number.isFinite(at) && at >= cutoff) claimable.push(r);
      else tooOld.push(r);
    }

    if (claimable.length > 0) {
      const mine = await readAll(userId);
      const ids = new Set(mine.map((r) => r.clientId));
      await writeAll(userId, [...mine, ...claimable.filter((r) => !ids.has(r.clientId))]);
    }

    // Anything not claimed stays where it is rather than being deleted: it is
    // still somebody's only copy, and this function's job is to attach, not to
    // tidy up after a decision nobody made.
    if (tooOld.length > 0) await writeAll(UNCLAIMED, tooOld);
    else await AsyncStorage.removeItem(keyFor(UNCLAIMED));

    return claimable.length;
  } catch {
    return 0;
  }
}

/** How many recordings are sitting unattached. */
export async function countUnclaimed(): Promise<number> {
  return (await readAll(UNCLAIMED)).length;
}

/**
 * Which pipeline a recording belongs to, for records old and new.
 *
 * ALWAYS READ THE KIND THROUGH THIS. A recording saved before the field existed
 * has no `kind`, and it is a session — that is what every recording was. Reading
 * `rec.kind` directly would make those `undefined` and send them nowhere, which
 * on this path means a rep's unsent conversation.
 */
export function recordingKind(rec: {
  kind?: 'session' | 'pitch';
}): 'session' | 'pitch' {
  return rec.kind === 'pitch' ? 'pitch' : 'session';
}

/**
 * WHICH UPLOADER a recording needs.
 *
 * Separated from the sender itself so the DECISION can be tested. The sender
 * dynamically imports native modules, so it cannot run under the test runner —
 * but choosing wrongly is the whole failure this exists to prevent, and a
 * decision nobody can test is one that drifts. The import stays untestable; the
 * choice does not have to be.
 */
export function uploaderFor(rec: { kind?: 'session' | 'pitch' }): 'door-log' | 'coaching-session' {
  return recordingKind(rec) === 'pitch' ? 'door-log' : 'coaching-session';
}
