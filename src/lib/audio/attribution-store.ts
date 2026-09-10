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
export type PendingSegment = {
  speakerId: string;
  text: string;
  seq: number;
  /**
   * Seconds into the audio, when the server knew it.
   *
   * IT IS THE PACE SKILL, and it is the only thing that makes it work. The
   * server stamps `spoken_at` from this when the transcript is labelled, and the
   * "speed" skill needs three timed agent turns before it will score anything.
   * Without it every uploaded call reads "not enough sessions yet" forever.
   *
   * DECLARED HERE RATHER THAN LEFT TO SURVIVE BY ACCIDENT. The payload is stored
   * and echoed as JSON, so an undeclared field rides along on its own — until
   * somebody normalises this list and the skill goes quiet again with nothing
   * failing. See `attributionSegments` in upload-flow.ts, which keeps it on
   * purpose and is tested for it.
   */
  startSeconds?: number;
};

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
    /*
     * THE SAME RULE, WRITTEN TWICE, AND I ONLY FIXED ONE. The write guard below
     * refused a single-voice payload; this one discarded it on the way back out.
     * Changing the write alone made the store accept a payload it would never
     * return — and the test that caught it was the one asserting the new
     * behaviour, not any existing test.
     *
     * A voice count is a rule about whether there is a QUESTION to ask, and it
     * now lives in one place: `writePendingAttribution`. This side only checks
     * that what came back is structurally usable.
     */
    if (!parsed?.sessionId || !Array.isArray(parsed.speakers) || parsed.speakers.length < 1) {
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
  /*
   * ONE SPEAKER IS STILL A QUESTION WORTH ASKING, and this used to refuse it.
   *
   * The guard was `< 2`, on the reasoning that one voice leaves nothing to
   * choose between. The consequence was not "no prompt" - it was NO TRANSCRIPT
   * AT ALL, ever, silently: the transcript is only written when the rep answers,
   * so a solo recording was transcribed, its duration stamped, and then dropped.
   * Measured on production 10 September 2026: of 16 uploaded recordings, 13 had
   * audio and no transcript.
   *
   * With one voice the question changes but does not disappear. "Is this you, or
   * the customer?" has a real answer that the app cannot work out for itself -
   * one-sided capture, where only the prospect was picked up, genuinely happens
   * and is what doc 08's one-sided status exists for.
   */
  if (entry.speakers.length < 1 || entry.segments.length === 0) return false;
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
