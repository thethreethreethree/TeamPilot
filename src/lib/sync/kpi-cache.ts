/**
 * The last set of numbers the server sent, kept on the device.
 *
 * WHY IT EXISTS. The sessions list and a session's detail both open from cache;
 * the KPI board did not, so the one screen a rep is most likely to look at on a
 * train or between calls was the one that said "no connection". That is an
 * inconsistency the rep experiences as the app being unreliable, not as three
 * screens with different sync strategies.
 *
 * WHY THIS IS SAFE TO CACHE, AND WHERE THE LINE IS. These are the rep's own
 * figures, already shown to them on screen. The app does not recompute anything
 * from them — a second copy of the KPI formula on the device is the drift the
 * architecture forbids, and
 * caching the SERVER'S ANSWER is the opposite of that: it is still the server's
 * verdict, just one that arrived earlier.
 *
 * SHORTER-LIVED THAN THE SESSION CACHE, DELIBERATELY. A session's transcript is
 * a record of something that happened and does not go out of date. A conversion
 * rate does — every call a rep makes changes it. A day old is context; a week
 * old is a number that will quietly mislead someone into thinking they have not
 * moved.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KpiResponse } from '@/types/backend';

const PREFIX = 'kpi.v1';

/** Keyed by scope as well as user: an admin's company view and their own view
 *  are different answers and must never be shown in place of each other. */
const keyFor = (userId: string, scope: string) => `${PREFIX}.${userId}.${scope}`;

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Cached = { res: KpiResponse; at: string };

export async function readCachedKpi(
  userId: string,
  scope: 'self' | 'company' = 'self',
): Promise<{ res: KpiResponse; at: Date } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, scope));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Cached;
    // `metrics` is what the board renders. Without it there is nothing to show,
    // and a board of empty rows would read as "you have no numbers" rather than
    // "this could not be loaded".
    if (!parsed?.res || typeof parsed.res.metrics !== 'object' || parsed.res.metrics === null) {
      return null;
    }

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime()) || Date.now() - at.getTime() > MAX_AGE_MS) {
      await AsyncStorage.removeItem(keyFor(userId, scope)).catch(() => {});
      return null;
    }

    return { res: parsed.res, at };
  } catch {
    return null;
  }
}

export async function writeCachedKpi(
  userId: string,
  scope: 'self' | 'company',
  res: KpiResponse,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(userId, scope),
      JSON.stringify({ res, at: new Date().toISOString() } satisfies Cached),
    );
  } catch {
    // Failing to cache must never fail the screen the rep is reading.
  }
}

/** Called on sign-out. A rep's figures are not for the next person to hold the phone. */
export async function clearCachedKpi(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(`${PREFIX}.${userId}.`));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    /* nothing to recover */
  }
}
