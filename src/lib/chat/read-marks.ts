/**
 * When this rep last read each topic, on this phone.
 *
 * WHY NOT THE COLUMN THAT LOOKS LIKE IT IS FOR THIS. `chat_participants` has a
 * `last_seen_at`, and it is tempting. It is set by a database TRIGGER when a
 * participant POSTS a message — so it means "last time you spoke", not "last
 * time you read". A rep who reads every day and posts once a month would show
 * every topic as unread forever.
 *
 * The column could be repurposed: nothing in the web currently reads it, and the
 * update policy would allow it. But its own comment calls it "per-user
 * analytics", and quietly redefining a column in someone else's product — from
 * a client, without changing the schema or telling anyone — is how two systems
 * end up disagreeing about what a number means. So this keeps its own marker
 * instead.
 *
 * THE HONEST LIMIT OF THAT CHOICE, stated because a rep will notice it: read
 * state is PER DEVICE. Reading a topic on the phone does not mark it read on the
 * website, and the reverse. That is arguably the truer answer — you did not read
 * it on the website — but it is a difference, and the screen never claims
 * otherwise.
 *
 * KEYED PER USER. Reps share phones, and one person's unread state must not
 * appear to be another's.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId: string) => `chat-read.v1.${userId}`;

/** topicId → ISO timestamp of the newest message the rep had seen. */
export type ReadMarks = Record<string, string>;

export async function readMarks(userId: string): Promise<ReadMarks> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ReadMarks = {};
    for (const [id, at] of Object.entries(parsed)) {
      if (typeof id === 'string' && typeof at === 'string') out[id] = at;
    }
    return out;
  } catch {
    // A corrupt marker file means everything reads as unread, which is the safe
    // direction to fail: a rep is shown a topic they have already read, rather
    // than never being shown one they have not.
    return {};
  }
}

/**
 * Mark a topic read up to a moment.
 *
 * Takes the timestamp of the newest message the rep actually had on screen,
 * rather than "now". Marking to `now` would swallow a message that landed while
 * they were reading — it would be counted as read without ever being shown.
 */
export async function markRead(
  userId: string,
  topicId: string,
  newestMessageAt: string | null,
): Promise<void> {
  if (!newestMessageAt) return;
  try {
    const marks = await readMarks(userId);
    const held = marks[topicId];
    // Never move the marker BACKWARDS. Opening an old topic after a newer read
    // would otherwise resurrect messages the rep has already dealt with.
    if (held && held >= newestMessageAt) return;
    marks[topicId] = newestMessageAt;
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(marks));
  } catch {
    // Failing to remember costs a topic that still looks unread. Harmless.
  }
}

/** Called on sign-out — one rep's unread state is not the next one's. */
export async function clearReadMarks(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}

/**
 * Does this topic have something the rep has not seen?
 *
 * FALSE whenever the answer is not knowable. A topic the rep is not in has no
 * readable messages, so it cannot be unread to them; a topic with no last
 * message has nothing to be unread. Guessing "unread" in either case produces a
 * badge that can never be cleared, which trains a rep to ignore the badge.
 */
export function isUnread(
  topic: { joined: boolean; lastMessageAt: string | null },
  marks: ReadMarks,
  topicId: string,
): boolean {
  if (!topic.joined || !topic.lastMessageAt) return false;
  const seen = marks[topicId];
  // Never opened, and there is something in it — genuinely unread.
  if (!seen) return true;
  return topic.lastMessageAt > seen;
}
