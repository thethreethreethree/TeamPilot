/**
 * Every door knocked, kept until the server has it.
 *
 * WHY THIS IS NOT THE WRITE OUTBOX. The outbox holds INSTRUCTIONS and replaces
 * them: a rep who marks a call Sold and then No sale has changed their mind, so
 * only the last one is sent. A knock is the opposite — it is an EVENT. Two
 * knocks at two doors are two facts, and collapsing them would silently delete a
 * door the rep actually knocked. Same shape of storage, opposite rule, so it
 * gets its own store rather than a flag on the other one.
 *
 * WHY IT CAN RETRY SAFELY. The server route is explicit: *"Idempotent on
 * client_knock_id (offline queue may retry)"*. Every knock is stamped with an id
 * here, before any network call, and that id is what makes a repeat harmless.
 * Without it a bad connection would turn one door into three.
 *
 * WHY THE ID IS MADE ON THE PHONE, AT THE TAP. It is the only moment that
 * definitely happened. Generating it at send time would give a retried knock a
 * new id and defeat the idempotency the server offers.
 *
 * SPEED IS THE FEATURE. A door-to-door rep taps this dozens of times an hour,
 * one-handed, walking. So the tap writes locally and returns — nothing waits on
 * a network, and nothing is ever confirmed with a dialog. The count on screen
 * moves immediately because the LOCAL record moved; the server catches up.
 *
 * NOTHING IS EVER DROPPED FOR AGE. A recording expires from its queue after a
 * month because it is a large file; a knock is forty bytes, and a rep's day of
 * doors that failed to send for a week is still their day. They stay until sent.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { countStored, type StrandedCount } from '@/lib/stranded-count';

/** The server's own vocabulary, from the door-log route's Zod schema. */
export type KnockOutcome =
  | 'no_answer'
  | 'sold'
  | 'go_back'
  | 'non_decision_maker'
  | 'not_interested';

export const KNOCK_OUTCOMES: KnockOutcome[] = [
  'no_answer',
  'sold',
  'go_back',
  'non_decision_maker',
  'not_interested',
];

export type Knock = {
  /** The idempotency key. Made at the tap, never regenerated. */
  clientKnockId: string;
  outcome: KnockOutcome;
  /** The rep's LOCAL date — the server takes YYYY-MM-DD and a day is a local thing. */
  localDate: string;
  /** When it was tapped, for ordering and for showing "today". */
  at: string;
  attempts: number;
  lastError?: string;
};

const keyFor = (userId: string) => `knocks.v1.${userId}`;

let seq = 0;
/**
 * A new idempotency key.
 *
 * The clock alone is not enough — a rep tapping "No answer" twice on a terrace
 * of identical doors can produce two knocks inside the same millisecond, and two
 * knocks sharing an id would be deduplicated by the server into one. That is a
 * door erased. The counter makes a collision impossible.
 */
export function newKnockId(): string {
  return `k_${Date.now().toString(36)}_${(++seq).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** YYYY-MM-DD in the rep's own timezone, never UTC. */
export function localDate(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  // Built from local components on purpose. `toISOString().slice(0,10)` would
  // file a 9 p.m. knock under tomorrow for every rep west of Greenwich, and
  // their day's total would be split across two dates.
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

async function readAll(userId: string): Promise<Knock[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is Knock =>
        Boolean(k) &&
        typeof k.clientKnockId === 'string' &&
        typeof k.outcome === 'string' &&
        typeof k.localDate === 'string',
    );
  } catch {
    return [];
  }
}

async function writeAll(userId: string, rows: Knock[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(rows));
  } catch {
    // The tap has already moved the count on screen. Failing loudly here would
    // interrupt a rep mid-street for something they cannot act on.
  }
}

/**
 * Record a knock. Returns immediately — nothing here touches the network.
 */
export async function addKnock(
  userId: string,
  outcome: KnockOutcome,
  now: Date = new Date(),
): Promise<Knock> {
  const knock: Knock = {
    clientKnockId: newKnockId(),
    outcome,
    localDate: localDate(now),
    at: now.toISOString(),
    attempts: 0,
  };
  const rows = await readAll(userId);
  rows.push(knock);
  await writeAll(userId, rows);
  return knock;
}

/** Everything not yet sent, oldest first — the order it will be sent in. */
export async function listKnocks(userId: string): Promise<Knock[]> {
  return readAll(userId);
}

/**
 * How many are waiting, or NULL when the store could not be read.
 *
 * Used only by the sign-out warning, which speaks solely when a count is above
 * zero - so a read failure returning 0 does not soften that warning, it deletes
 * it. `listX` above still returns an empty list on failure, which is right for
 * the screens that render one.
 */
export function countKnocksOrUnknown(userId: string): Promise<StrandedCount> {
  return countStored((k) => AsyncStorage.getItem(k), keyFor(userId));
}

/** Remove one, once the server has confirmed it. */
export async function removeKnock(userId: string, clientKnockId: string): Promise<void> {
  const rows = await readAll(userId);
  await writeAll(
    userId,
    rows.filter((k) => k.clientKnockId !== clientKnockId),
  );
}

/** Record a failed attempt without losing the knock. */
export async function markKnockFailed(
  userId: string,
  clientKnockId: string,
  message?: string,
): Promise<void> {
  const rows = await readAll(userId);
  const at = rows.findIndex((k) => k.clientKnockId === clientKnockId);
  if (at < 0) return;
  rows[at] = { ...rows[at], attempts: rows[at].attempts + 1, lastError: message };
  await writeAll(userId, rows);
}

/**
 * Take back the last knock.
 *
 * A rep walking a street taps fast and will sometimes tap the wrong button, and
 * a mis-tap that cannot be undone is a number they stop trusting. Only a knock
 * still WAITING can be taken back — once the server has it, the honest answer is
 * that it is on the record, and pretending otherwise would leave the phone and
 * the server disagreeing.
 */
export async function undoLastKnock(userId: string): Promise<Knock | null> {
  const rows = await readAll(userId);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  await writeAll(userId, rows.slice(0, -1));
  return last;
}

/**
 * What today looks like from this phone alone.
 *
 * Counted from the LOCAL queue so the screen moves the instant a rep taps, with
 * no network in the way. The screen adds this to the server's own totals for the
 * same day — see the door-log view for why that sum is stated rather than
 * silently blended.
 */
export function countByOutcome(
  rows: Knock[],
  date: string,
): Record<KnockOutcome, number> {
  const out = {
    no_answer: 0,
    sold: 0,
    go_back: 0,
    non_decision_maker: 0,
    not_interested: 0,
  } as Record<KnockOutcome, number>;
  for (const k of rows) {
    if (k.localDate === date && k.outcome in out) out[k.outcome] += 1;
  }
  return out;
}

/** Called on sign-out — a knock belongs to the rep who made it. */
export async function clearKnocks(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}

/** Test seam. */
export function __resetKnockSeq(): void {
  seq = 0;
}
