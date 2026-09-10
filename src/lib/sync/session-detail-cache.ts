/**
 * An on-device copy of one session's detail — the row, its transcript and its
 * cues — so a rep can re-read a pitch without signal.
 *
 * WHY THIS IS A FILE AND NOT AsyncStorage. It used to be a key-value entry with
 * a 1 MB ceiling, and anything larger was refused outright. That ceiling landed
 * on exactly the wrong sessions: a two-hour appointment produces thousands of
 * transcript segments, and the long difficult call is the one a rep most wants
 * to re-read on the way home. The short ones cached; the ones that mattered did
 * not.
 *
 * AsyncStorage is a SQLite row on Android with a practical per-entry limit, and
 * the right answer for a multi-megabyte document is a file. The app already
 * writes recordings to the documents directory, so this is the same mechanism
 * rather than a new one — and a file carries no ceiling worth designing around.
 *
 * WHY THE CEILING IS NOT SIMPLY RAISED. A larger number would still be a number,
 * and the same rep would hit it with a longer call. Refusing to store PART of a
 * transcript remains right — a conversation that ends mid-sentence with nothing
 * saying why is the silent truncation this whole app is built to avoid — so the
 * fix is to remove the reason to truncate at all.
 *
 * WHAT IS NOT KEPT: nothing secret. This is the rep's own data, already shown to
 * them on screen and already fetched under RLS. Files live under the user's own
 * folder and the folder is deleted on sign-out, because reps share phones.
 *
 * NEVER A LIE. Every copy carries the time it was fetched, and the screen says
 * so. A cached transcript presented as live is how a rep concludes a session has
 * no coach cues when four arrived after the copy was taken.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { CoachingCue, CoachingSession, TranscriptSegment } from '@/types/backend';

const FOLDER = 'session-cache';

/**
 * The same week the session list uses. Transcript and cues are append-only on
 * the server, so a cached copy goes stale by omission rather than by being
 * wrong — but a week-old copy of a conversation is still not something to
 * present without saying when it came from.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How many sessions a rep may hold offline at once.
 *
 * Removing the per-session size ceiling was right — a long call is the one most
 * worth having — but it means a single copy can now be megabytes, and nothing
 * else bounds the total. A rep who browses two hundred sessions would otherwise
 * fill their phone with copies the app never reclaims, and the first symptom
 * would be the recorder refusing to start because the disk is full. That is a
 * bad trade: the app would have spent the space that a call needs on transcripts
 * of calls already recorded.
 *
 * Fifty is well past what anyone re-reads and small enough to stay modest even
 * if every one is long. The OLDEST go first, because the reason to keep a
 * transcript is recency.
 */
const MAX_CACHED_SESSIONS = 50;

export type CachedDetail = {
  session: CoachingSession;
  segments: TranscriptSegment[];
  cues: CoachingCue[];
  /** ISO time this was fetched from the server. */
  at: string;
};

/** One folder per rep, so a sign-out sweep is a single directory delete and
 *  cannot accidentally take someone else's copies with it. */
function userDirectory(userId: string, create: boolean): Directory | null {
  try {
    const root = new Directory(Paths.document, FOLDER);
    if (!root.exists) {
      if (!create) return null;
      root.create({ intermediates: true });
    }
    const dir = new Directory(root, encodeURIComponent(userId));
    if (!dir.exists) {
      if (!create) return null;
      dir.create({ intermediates: true });
    }
    return dir;
  } catch {
    return null;
  }
}

function fileFor(userId: string, sessionId: string, create: boolean): File | null {
  const dir = userDirectory(userId, create);
  if (!dir) return null;
  try {
    return new File(dir, `${encodeURIComponent(sessionId)}.json`);
  } catch {
    return null;
  }
}

export async function readCachedDetail(
  userId: string,
  sessionId: string,
): Promise<CachedDetail | null> {
  try {
    const file = fileFor(userId, sessionId, false);
    if (!file || !file.exists) return null;

    const parsed = JSON.parse(await file.text()) as CachedDetail;
    // A cached detail with no session row cannot render anything; the arrays may
    // legitimately be empty (a session with no transcript yet).
    if (!parsed?.session?.id || !Array.isArray(parsed.segments) || !Array.isArray(parsed.cues)) {
      return null;
    }

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime()) || Date.now() - at.getTime() > MAX_AGE_MS) {
      try {
        file.delete();
      } catch {
        /* stale and unreadable is the same as absent */
      }
      return null;
    }

    return parsed;
  } catch {
    // A corrupt or unreadable copy is not an error worth surfacing. Treat it as
    // absent and let the network read replace it.
    return null;
  }
}

export async function writeCachedDetail(
  userId: string,
  sessionId: string,
  detail: Omit<CachedDetail, 'at'>,
): Promise<void> {
  try {
    const file = fileFor(userId, sessionId, true);
    if (!file) return;
    const payload: CachedDetail = { ...detail, at: new Date().toISOString() };
    // Written whole. There is no size branch any more: a file has no ceiling
    // that a real call would reach, so there is nothing to truncate and nothing
    // to refuse.
    file.write(JSON.stringify(payload));

    // Bounded by COUNT, not by size — so no individual transcript is ever cut
    // short to make room. Evicting a whole session loses an offline copy the rep
    // can fetch again; truncating one would leave them reading a conversation
    // that stops mid-sentence with nothing saying why.
    evictOldest(userId);
  } catch {
    // Failing to cache must never fail the screen the rep is looking at. A
    // full disk is a slower screen next time, not an error now.
  }
}

/**
 * Called on sign-out. One directory delete: the set of cached sessions is not
 * knowable in advance, and leaving one rep's transcripts for the next person to
 * sign in is the failure that matters here.
 */
export async function clearAllCachedDetails(userId: string): Promise<void> {
  try {
    const dir = userDirectory(userId, false);
    if (dir?.exists) dir.delete();
  } catch {
    /* nothing to recover */
  }
}

/**
 * Keep the newest MAX_CACHED_SESSIONS copies and delete the rest.
 *
 * The age is read from inside each file rather than from filesystem metadata,
 * because that timestamp is the one the screen already shows and trusts — using
 * a different clock here would evict by one rule and label by another.
 *
 * Never throws. Failing to evict is wasted space; failing the write that just
 * succeeded would cost the rep the copy they were promised.
 */
function evictOldest(userId: string): void {
  try {
    const dir = userDirectory(userId, false);
    if (!dir) return;

    const entries = dir.list().filter((f): f is File => f instanceof File);
    if (entries.length <= MAX_CACHED_SESSIONS) return;

    const dated = entries.map((f) => {
      let at = 0;
      try {
        const parsed = JSON.parse(f.textSync()) as CachedDetail;
        const parsedAt = new Date(parsed?.at ?? '').getTime();
        if (Number.isFinite(parsedAt)) at = parsedAt;
      } catch {
        // Unreadable: treated as oldest, so a corrupt copy is the first to go.
      }
      return { file: f, at };
    });

    dated
      .sort((a, b) => b.at - a.at)
      .slice(MAX_CACHED_SESSIONS)
      .forEach(({ file }) => {
        try {
          file.delete();
        } catch {
          /* wasted space, not lost data */
        }
      });
  } catch {
    /* eviction is housekeeping; never let it break a successful write */
  }
}

/**
 * How much of the phone the saved transcripts are using.
 *
 * The recorder refuses to start when the disk is nearly full and names what this
 * app is holding, so a rep can act on it. Recordings were already counted;
 * without this, cached transcripts were invisible — and since the size ceiling
 * was removed they can easily be the larger half. A rep told to free space while
 * the app quietly holds two hundred megabytes of re-downloadable text is being
 * sent to delete the wrong things.
 */
export function cachedDetailBytes(userId: string): number {
  try {
    const dir = userDirectory(userId, false);
    if (!dir) return 0;
    return dir
      .list()
      .filter((f): f is File => f instanceof File)
      .reduce((sum, f) => sum + (f.size ?? 0), 0);
  } catch {
    return 0;
  }
}
