/**
 * The last team roster the server sent, kept on the device.
 *
 * WHY THE WINDOW IS SHORTER THAN EVERY OTHER CACHE HERE. Not because the data
 * moves faster — it moves at about the same rate as the KPI board. Because of
 * what a stale copy makes someone DO.
 *
 * A stale conversion rate on your own board is a number you misread for a day.
 * A stale "slipping" flag sends a manager into a conversation with a rep about a
 * problem that has already resolved — and the rep, who fixed it, gets told they
 * are behind. That conversation cannot be taken back by a later refresh. So this
 * one expires in hours rather than a day, and says its age prominently rather
 * than in passing.
 *
 * WHY IT IS CACHED AT ALL. A manager between calls, on a train, wanting to know
 * who to ring is exactly the case the app exists for. Refusing to hold it would
 * make the screen useless in the moment it is most wanted.
 *
 * IT HOLDS OTHER PEOPLE'S FIGURES, which is true of nothing else stored on this
 * device. It is keyed per user and swept on sign-out for the same reason as the
 * rest — but here the reason is sharper: the next person to hold this phone must
 * not find a roster of their colleagues' performance.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TeamResponse } from '@/types/backend';

const PREFIX = 'team.v1';

const keyFor = (userId: string) => `${PREFIX}.${userId}`;

/** Six hours. See above: the cost of staleness here is a conversation, not a
 *  misread number. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

type Cached = { res: TeamResponse; at: string };

export async function readCachedTeam(
  userId: string,
): Promise<{ res: TeamResponse; at: Date } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Cached;
    // `agents` is what the screen draws. Without it there is nothing to show,
    // and an empty roster would read as "you have no team".
    if (!parsed?.res || !Array.isArray(parsed.res.agents)) return null;

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime()) || Date.now() - at.getTime() > MAX_AGE_MS) {
      await AsyncStorage.removeItem(keyFor(userId)).catch(() => {});
      return null;
    }
    return { res: parsed.res, at };
  } catch {
    return null;
  }
}

export async function writeCachedTeam(userId: string, res: TeamResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify({ res, at: new Date().toISOString() } satisfies Cached),
    );
  } catch {
    // Failing to cache must never fail the screen the manager is reading.
  }
}

/** Called on sign-out. Colleagues' figures are not the next person's to read. */
export async function clearCachedTeam(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}
