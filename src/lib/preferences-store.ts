/**
 * Where the two preferences live on this phone.
 *
 * SPLIT FROM THE SUPABASE CALL for the reason this project has now hit six
 * times: anything reaching the network drags a native module behind it and
 * cannot load under the test runner. The sign-out sweep must clear this, and the
 * sweep is the boundary that stops one rep's settings reaching the next person
 * to hold the phone — so it has to be testable.
 *
 * TWO SEPARATE THINGS ARE KEPT, and conflating them is the bug this shape
 * avoids:
 *
 *   CACHE    the last answer the server gave. Lets the screen open on the right
 *            state instead of flickering through "Not loaded".
 *   PENDING  a change the rep made that has NOT reached the server. It outranks
 *            the cache and the server both, until the write lands.
 *
 * If pending were folded into the cache, a refresh would overwrite the rep's own
 * unsent choice with the server's stale one — which is exactly the Macro Mode
 * complaint, rebuilt.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { readExperienceMode, readLearningMode, type PendingPreferences, type Preferences, UNREAD } from './preferences';

const cacheKey = (userId: string) => `prefs.v1.${userId}`;
const pendingKey = (userId: string) => `prefs-pending.v1.${userId}`;

function parse(raw: string | null): Preferences {
  if (!raw) return UNREAD;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      learningMode: readLearningMode(o?.learningMode),
      experienceMode: readExperienceMode(o?.experienceMode),
    };
  } catch {
    // A corrupt cache is an unread cache. It costs one server round trip.
    return UNREAD;
  }
}

export async function readCachedPreferences(userId: string): Promise<Preferences> {
  try {
    return parse(await AsyncStorage.getItem(cacheKey(userId)));
  } catch {
    return UNREAD;
  }
}

export async function cachePreferences(userId: string, prefs: Preferences): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(prefs));
  } catch {
    // Costs a flicker on the next launch. Nothing is lost.
  }
}

export async function readPendingPreferences(userId: string): Promise<PendingPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return null;
    const parsed = parse(raw);
    // Only fields that actually hold a value are pending. A null here means
    // "not changed", not "changed to nothing".
    const out: PendingPreferences = {};
    if (parsed.learningMode !== null) out.learningMode = parsed.learningMode;
    if (parsed.experienceMode !== null) out.experienceMode = parsed.experienceMode;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Record a change the rep made, merged over anything already waiting. */
export async function markPending(userId: string, change: PendingPreferences): Promise<void> {
  try {
    const held = (await readPendingPreferences(userId)) ?? {};
    await AsyncStorage.setItem(pendingKey(userId), JSON.stringify({ ...held, ...change }));
  } catch {
    // The rep's choice is still on screen; it will be re-sent on the next tap.
  }
}

/**
 * Clear a pending change once it has genuinely landed.
 *
 * Takes the value that was SENT, not "clear everything". If the rep toggled
 * again while the write was in flight, the newer choice is still waiting and
 * must not be thrown away by the older write's success.
 */
export async function clearPending(userId: string, sent: PendingPreferences): Promise<void> {
  try {
    const held = await readPendingPreferences(userId);
    if (!held) return;
    const out: PendingPreferences = { ...held };
    for (const k of Object.keys(sent) as (keyof PendingPreferences)[]) {
      if (held[k] === sent[k]) delete out[k];
    }
    if (Object.keys(out).length) {
      await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(out));
    } else {
      await AsyncStorage.removeItem(pendingKey(userId));
    }
  } catch {
    /* the next successful write clears it */
  }
}

/**
 * Sign-out sweep: the CACHE only.
 *
 * NOT THE PENDING CHANGE, and the distinction is the one this app already got
 * wrong once — knocks were briefly added to the sweep, which would have deleted
 * a rep's whole day of doors at the moment they signed out.
 *
 * The cache is a copy of an answer the server already has, so dropping it costs
 * one request. A pending change is the opposite: it is the rep's own choice that
 * has NOT reached the server, and it is the only copy in existence. It survives
 * sign-out exactly as an unsent outcome or an unsent knock does, and goes out
 * when they sign back in. It is keyed per user, so the next person on this phone
 * never sees it.
 */
export async function clearCachedPreferences(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(userId));
  } catch {
    /* nothing to recover */
  }
}

/**
 * Everything, cache and pending both.
 *
 * Deliberately NOT what the sign-out sweep calls — see above. This exists for a
 * caller that genuinely means "discard this rep's unsent preference too", and
 * nothing does that today.
 */
export async function clearStoredPreferences(userId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([cacheKey(userId), pendingKey(userId)]);
  } catch {
    /* nothing to recover */
  }
}
