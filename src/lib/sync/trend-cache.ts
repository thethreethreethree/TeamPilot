/**
 * The last trend the server sent, kept on the device.
 *
 * WHY IT LIVES MUCH LONGER THAN THE KPI CACHE. The board's figures are computed
 * live and move with every call a rep makes, so a copy older than a day starts
 * misleading. These are FROZEN MONTHLY SNAPSHOTS: a month is sealed when it
 * ends and never changes afterwards. The only thing that can make this stale is
 * a new month closing — so a week-old copy is not a week out of date, it is
 * exactly right for every month except possibly the current one.
 *
 * Copying the board's 24-hour rule here would have thrown away a correct answer
 * every day for no reason, and left a rep on a train looking at "no connection"
 * for data that could not have changed.
 *
 * STILL NEVER A LIE. The age is stored and the screen says it, because the one
 * thing that CAN have changed is the newest month — and that is the month a rep
 * is most likely to be looking for.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrajectoryResponse } from '@/types/backend';

const PREFIX = 'trend.v1';

const keyFor = (userId: string) => `${PREFIX}.${userId}`;

/** A week. See the note above: frozen months do not drift. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Cached = { res: TrajectoryResponse; at: string };

export async function readCachedTrend(
  userId: string,
): Promise<{ res: TrajectoryResponse; at: Date } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Cached;
    // `metrics` is what the screen draws. Without it there is nothing to show,
    // and an empty trend would read as "you have no history" rather than as
    // "this could not be loaded".
    if (!parsed?.res || !Array.isArray(parsed.res.metrics)) return null;

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

export async function writeCachedTrend(
  userId: string,
  res: TrajectoryResponse,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify({ res, at: new Date().toISOString() } satisfies Cached),
    );
  } catch {
    // Failing to cache must never fail the screen the rep is reading.
  }
}

/** Called on sign-out. A rep's months are not the next person's to read. */
export async function clearCachedTrend(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}
