/**
 * Transcripts waiting to be told which voice is the rep.
 *
 * WHY IT HAS TO BE STORED AT ALL. When a recording finishes uploading the server
 * diarizes it and hands back the speakers plus the segments — but the segments
 * come back keyed by an anonymous `speakerId`, and the labelling route needs
 * them ECHOED BACK alongside the answer. It cannot be re-fetched: the server's
 * stored copy has already been flattened to agent/customer/unknown and no longer
 * carries the diarized ids. So if the app forgets the payload, the transcript
 * can never be attributed.
 *
 * WHY IT CANNOT JUST ASK IMMEDIATELY. Uploads run in the background the moment
 * signal returns — the rep is usually not looking at the phone when a recording
 * completes. Asking "which voice is you?" at that instant would mean the
 * question is missed and the answer lost.
 *
 * WHAT AN UNATTRIBUTED TRANSCRIPT COSTS. Every line reads as `unknown`. The
 * session screen shows a wall of unattributed speech, and the coach — which is
 * handed that transcript — reasons about a conversation it cannot tell apart.
 * The number that matters most (who said what) is exactly the one that is
 * missing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'attribution.v1';

const keyFor = (userId: string, sessionId: string) => `${PREFIX}.${userId}.${sessionId}`;

/**
 * The server accepts at most 5,000 segments. Past this the payload is not kept:
 * a truncated one would relabel PART of a call and silently drop the rest, which
 * is worse than leaving it unattributed and saying so.
 */
const MAX_BYTES = 1024 * 1024;

/** A voice the server found, with a line of what it said so a rep can recognise it. */
export type PendingSpeaker = { speakerId: string; sample: string };

/** One segment exactly as the labelling route wants it echoed back. */
export type PendingSegment = { speakerId: string; text: string; seq: number };

export type PendingAttribution = {
  sessionId: string;
  /** What the call was filed under, so the prompt can name it. */
  label: string | null;
  speakers: PendingSpeaker[];
  segments: PendingSegment[];
  /** ISO time the recording was transcribed. */
  at: string;
};

/** Anything older than this is dropped — an unanswered prompt is not forever. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function readPendingAttribution(
  userId: string,
  sessionId: string,
): Promise<PendingAttribution | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, sessionId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingAttribution;
    // Fewer than two voices is not a question worth asking — there is nothing to
    // choose between, and a one-option picker is a decision the app already made.
    if (!parsed?.sessionId || !Array.isArray(parsed.speakers) || parsed.speakers.length < 2) {
      return null;
    }
    if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) return null;

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime()) || Date.now() - at.getTime() > MAX_AGE_MS) {
      await AsyncStorage.removeItem(keyFor(userId, sessionId)).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Remember a transcript that needs attributing.
 *
 * Returns whether it was kept. A false is not a silent failure — the caller has
 * the payload in hand at that moment and can offer the question immediately,
 * which is the only remaining chance to ask it.
 */
export async function writePendingAttribution(
  entry: Omit<PendingAttribution, 'at'>,
  userId: string,
): Promise<boolean> {
  if (entry.speakers.length < 2 || entry.segments.length === 0) return false;
  try {
    const payload = JSON.stringify({ ...entry, at: new Date().toISOString() });
    if (payload.length > MAX_BYTES) return false;
    await AsyncStorage.setItem(keyFor(userId, entry.sessionId), payload);
    return true;
  } catch {
    return false;
  }
}

/** Called once the transcript has been attributed, or when the rep declines. */
export async function clearPendingAttribution(
  userId: string,
  sessionId: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId, sessionId));
  } catch {
    /* nothing to recover */
  }
}

/** Every session still waiting on an answer, for a rep to work through. */
export async function listPendingAttributions(
  userId: string,
): Promise<PendingAttribution[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(`${PREFIX}.${userId}.`));
    if (mine.length === 0) return [];

    const rows = await AsyncStorage.multiGet(mine);
    const out: PendingAttribution[] = [];
    for (const [, raw] of rows) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as PendingAttribution;
        if (parsed?.sessionId && parsed.speakers?.length >= 2) out.push(parsed);
      } catch {
        /* skip the unreadable one rather than losing the rest */
      }
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

/** Called on sign-out. These hold customer speech; they are not the next rep's. */
export async function clearAllPendingAttributions(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(`${PREFIX}.${userId}.`));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    /* nothing to recover */
  }
}
