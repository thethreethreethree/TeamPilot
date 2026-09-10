/**
 * A small on-device cache of the rep's session list, so the app opens to
 * content instead of a spinner.
 *
 * WHY THIS EXISTS: 03-DATA-MODEL-AND-SYNC.md makes stale-while-revalidate the
 * first rule of the sync model — "show the cached value instantly, refetch in
 * the background, reconcile". A rep between calls has seconds and a bad signal;
 * a spinner on every launch spends both.
 *
 * WHY AsyncStorage AND NOT expo-sqlite: the plan puts the SQLite cache and the
 * durable write outbox together in Phase 4, where they belong — an outbox needs
 * ordering and replay guarantees a key-value store cannot give. This is the read
 * cache only: one JSON blob, replaced whole, never merged. It holds no secret
 * (AsyncStorage is readable plaintext on a rooted device); session rows are the
 * rep's own data, and the auth token lives in the Keychain via
 * secure-session-store.ts, never here.
 *
 * THE RULE THAT MATTERS: cached data is a convenience, never a lie. Every read
 * comes back with the time it was written so the screen can say "as of 14:32"
 * rather than presenting a stale list as live.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachingSession } from '@/types/backend';

/**
 * Keyed per user id. Two reps sharing a phone — or one rep signing out and
 * another in — must never see each other's rows from the cache, and signing out
 * must not silently leave the previous person's sessions on disk for the next.
 */
const keyFor = (userId: string) => `sessions.v1.${userId}`;

/** Anything older than this is not shown at all: a week-old list is not context, it is a lie. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Cached = { rows: CoachingSession[]; at: string };

export async function readCachedSessions(
  userId: string,
): Promise<{ rows: CoachingSession[]; at: Date } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Cached;
    if (!parsed || !Array.isArray(parsed.rows) || !parsed.at) return null;

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) return null;
    if (Date.now() - at.getTime() > MAX_AGE_MS) {
      // Too old to show. Drop it rather than leaving it to be found later.
      await AsyncStorage.removeItem(keyFor(userId)).catch(() => {});
      return null;
    }

    return { rows: parsed.rows, at };
  } catch {
    // A corrupt cache is not an error worth surfacing — it is a cache. Treat it
    // as absent and let the network read populate a good one.
    return null;
  }
}

export async function writeCachedSessions(
  userId: string,
  rows: CoachingSession[],
): Promise<void> {
  try {
    const payload: Cached = { rows, at: new Date().toISOString() };
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(payload));
  } catch {
    // Failing to cache must never fail the screen the user is looking at.
  }
}

/** Called on sign-out. The next person to hold this phone starts empty. */
export async function clearCachedSessions(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}
