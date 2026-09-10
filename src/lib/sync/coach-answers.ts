/**
 * The last coach answer, kept on the device so leaving the screen does not
 * destroy it.
 *
 * WHY THIS EXISTS: the coach reply lived only in component state. A rep who
 * asked for a suggestion, backed out to check the transcript, and came back
 * found an empty screen — and the only way to see that answer again was to ask
 * for it again, which is a second model call, a second wait, and a different
 * answer. On a doorstep with one bar that is the difference between the feature
 * being useful and being abandoned.
 *
 * SCOPE, DELIBERATELY SMALL. One answer per session (plus one for the scratch
 * case where the rep pasted text with no session behind it). Not a thread, not a
 * history — the plan puts durable local storage in Phase 4 with the write
 * outbox, and inventing a schema here would be work Phase 4 has to undo.
 *
 * NOT A SECRET, BUT IT IS THE REP'S OWN WORK. AsyncStorage is plaintext on a
 * rooted device, so this holds only what the rep already typed and what the
 * coach already showed them on screen — no token, no customer record beyond the
 * conversation they pasted. It is keyed per user and cleared on sign-out for the
 * same reason the session cache is: two reps share a phone.
 *
 * NEVER A LIE. Every answer is stored with the time it was produced, so the
 * screen can say when it came from instead of presenting yesterday's suggestion
 * as a response to today's conversation.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'coach.answer.v1';

/** The scratch slot: text the rep pasted with no session behind it. */
export const SCRATCH_SLOT = 'scratch';

const keyFor = (userId: string, slot: string) => `${PREFIX}.${userId}.${slot}`;

/**
 * A suggestion older than this is not context, it is clutter. A day is chosen
 * over the session cache's week because a coach reply answers one moment in one
 * conversation; a week-old reply to "they said it's too expensive" is answering
 * a different customer.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type StoredAnswer = {
  /** What the rep asked about — kept so a restored answer is never orphaned. */
  conversation: string;
  guidance: string;
  reply: string;
  reasoning: string | null;
  intel: string | null;
  mode: 'suggest' | 'dissect';
  /** ISO time the answer was produced. */
  at: string;
};

export async function readAnswer(
  userId: string,
  slot: string,
): Promise<StoredAnswer | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, slot));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAnswer;
    // An entry with nothing to show is not worth restoring — it would put the
    // screen into a "done" state displaying nothing. "Read the prospect"
    // produces intel and no reply, so either one alone counts as an answer.
    if (!parsed) return null;
    const hasContent =
      (typeof parsed.reply === 'string' && parsed.reply.trim()) ||
      (typeof parsed.intel === 'string' && parsed.intel.trim());
    if (!hasContent) return null;

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime()) || Date.now() - at.getTime() > MAX_AGE_MS) {
      await AsyncStorage.removeItem(keyFor(userId, slot)).catch(() => {});
      return null;
    }

    return parsed;
  } catch {
    // A corrupt entry is treated as absent. The rep can always ask again.
    return null;
  }
}

/**
 * How large a stored entry may get before the conversation is left out of it.
 *
 * The conversation grows every time a rep uses "Used it — what next?", and a
 * pasted exchange can be large to begin with. Past a point the write fails on
 * quota — and because that failure is swallowed, it would take the ANSWER down
 * with it, silently. The answer is the part worth keeping; the conversation is
 * reconstructible from the session, or is still sitting in the rep's box.
 */
const MAX_ANSWER_BYTES = 256 * 1024;

export async function writeAnswer(
  userId: string,
  slot: string,
  answer: Omit<StoredAnswer, 'at'>,
): Promise<void> {
  // A partial answer from an aborted stream is still worth keeping; an empty one
  // is not, and would restore as a blank "done" screen. Intel alone counts.
  if (!answer.reply.trim() && !answer.intel?.trim()) return;

  const at = new Date().toISOString();
  const full = JSON.stringify({ ...answer, at } satisfies StoredAnswer);

  // Drop the conversation rather than the answer. Storing a TRIMMED
  // conversation was the other option and is worse: it would restore into the
  // rep's box as though it were what they wrote, quietly shorter.
  const payload =
    full.length <= MAX_ANSWER_BYTES
      ? full
      : JSON.stringify({ ...answer, conversation: '', at } satisfies StoredAnswer);

  try {
    await AsyncStorage.setItem(keyFor(userId, slot), payload);
  } catch {
    // Failing to save must never fail the answer the rep is reading right now.
  }
}

export async function clearAnswer(userId: string, slot: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId, slot));
  } catch {
    /* nothing to recover */
  }
}

/**
 * Called on sign-out. Sweeps every slot rather than a known list, because slots
 * are session ids and the set is not knowable in advance — the one thing that
 * must not happen is the next person on this phone finding the last one's
 * coaching.
 */
export async function clearAllAnswers(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(`${PREFIX}.${userId}.`));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    /* nothing to recover */
  }
}
