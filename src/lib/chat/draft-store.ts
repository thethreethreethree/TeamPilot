/**
 * Where an unsent chat message lives between screens.
 *
 * NO NETWORK IMPORTS, for the reason this project has now hit seven times: the
 * sign-out sweep has to be able to reach this, and anything importing Supabase
 * cannot load under the test runner.
 *
 * IT SURVIVES SIGN-OUT, deliberately, exactly as an unsent knock and an unsent
 * outcome do. These are words a person wrote and the server has never seen —
 * this phone holds the only copy. The sweep clears COPIES of things the server
 * already has; it must never clear the original of something it does not.
 * Keyed per user, so the next rep on a shared phone never sees them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HeldDraft } from './draft';

const keyFor = (userId: string, topicId: string) => `chat-draft.v1.${userId}.${topicId}`;

export async function readDraft(userId: string, topicId: string): Promise<HeldDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, topicId));
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const body = typeof o?.body === 'string' ? o.body : '';
    const at = typeof o?.at === 'number' && Number.isFinite(o.at) ? o.at : null;
    if (!body.trim() || at === null) return null;
    return { body, at };
  } catch {
    // A corrupt record reads as nothing held. The rep retypes; nothing is
    // claimed to have been sent.
    return null;
  }
}

/**
 * Hold a message that did not send.
 *
 * Keeps the ORIGINAL timestamp when one is already held, so the five-minute
 * automatic-send window measures from when the rep first tried — not from the
 * last retry. Without that, a phone retrying every time it sees signal would
 * refresh the clock forever and could deliver a message an hour late into a
 * conversation that had moved on.
 */
export async function holdDraft(
  userId: string,
  topicId: string,
  body: string,
  now: number,
  replyToId: string | null = null,
): Promise<void> {
  if (!body.trim()) return;
  try {
    const held = await readDraft(userId, topicId);
    const at = held?.at ?? now;
    await AsyncStorage.setItem(
      keyFor(userId, topicId),
      JSON.stringify({ body, at, replyToId }),
    );
  } catch {
    // The words are still on screen; the next attempt re-holds them.
  }
}

/** Called once the message has genuinely been posted. */
export async function clearDraft(userId: string, topicId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId, topicId));
  } catch {
    /* a stale draft reappears once and is cleared on the next successful send */
  }
}

/** Every topic this rep has unsent words in — for the sign-out warning. */
export async function draftsHeld(userId: string): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((k) => k.startsWith(`chat-draft.v1.${userId}.`)).length;
  } catch {
    return 0;
  }
}
