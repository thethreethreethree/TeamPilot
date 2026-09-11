/**
 * The name a recording is filed under when the rep has not typed one.
 *
 * ── WHY THIS EXISTS, AND IT IS NOT A CONVENIENCE ────────────────────────────────────────────────
 *
 * A recording could not leave the phone until it had a name. The rule was one line in
 * `isSendable`:
 *
 *     // No name means the rep has not said to send it yet.
 *     if (!rec.label || !rec.label.trim()) return false;
 *
 * The intent was consent - a name meant "I mean this one". What it produced was a queue. The
 * founder's own phone, 10 September 2026: **fifteen recordings held, 13.5 MB, and the Send-all
 * button offering three** - the other twelve had no name and so could never go, and nothing on the
 * screen said that was why. Every one of them is a real conversation with a customer that no
 * coaching engine has ever seen.
 *
 * It also made the app tell a lie it could not keep. Saving a door pitch says, in an alert: "It is
 * on this phone and sends itself when you have signal." For a pitch with no name that was simply
 * untrue, and the rep had no way to find out.
 *
 * So the consent moves to where it actually happened: pressing record. A rep who records a call
 * meant to record it. The name stays editable, and stays worth typing - "Rowan & Co, the corner
 * unit" is findable months later and "Door, 10 Sep at 4:53 PM" is not - but it is no longer the
 * difference between a coached call and a file nobody ever reads.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────────
 *
 * It does not guess WHO the call was with. The field asks "Who was this with?" and this cannot
 * know, so it does not pretend to: it says what kind of recording it is and when it was made, both
 * of which are facts. Inventing a plausible company name from a transcript would be the exact
 * failure this codebase spends its time removing - a confident answer where there is no knowledge.
 *
 * PURE, and it takes the instant rather than reading the clock, so the name in a test is the name
 * on the phone.
 */
import { clockTime, shortDate } from '@/lib/format';

/**
 * What each pipeline is called in a filed name.
 *
 * A `pitch` is a door; a `session` is a call taken or made. The two are different products inside
 * this app and a rep scanning a list is usually looking for one or the other.
 */
const KIND_WORD: Record<'session' | 'pitch', string> = {
  pitch: 'Door',
  session: 'Call',
};

/**
 * The last-resort name.
 *
 * Used only when the timestamp is unusable, which should not happen - it is written by the app at
 * capture. It is deliberately not empty: an empty name would put the recording straight back into
 * the queue this file exists to drain, which is the worst possible failure mode for a fallback.
 */
export const UNTITLED = 'Untitled recording';

export function autoTitle(rec: {
  recordedAt: string | null | undefined;
  kind?: 'session' | 'pitch';
}): string {
  const word = KIND_WORD[rec.kind ?? 'session'];
  const iso = typeof rec.recordedAt === 'string' ? rec.recordedAt : '';
  const day = shortDate(iso);
  const time = clockTime(iso);
  // Both come back empty for an unparseable instant, and half a name is worse than the fallback:
  // "Door, at " reads as a bug, which is what a rep would report it as.
  if (!day || !time) return UNTITLED;
  return `${word}, ${day} at ${time}`;
}

/**
 * The name this recording will actually be filed under.
 *
 * ONE FUNCTION, so the sender and the screen cannot disagree. The screen tells the rep what will
 * happen if they type nothing; the sender does that thing. Those being two expressions of the same
 * rule is how they drift into showing one name and sending another.
 */
export function filedAs(rec: {
  label?: string | null;
  recordedAt: string | null | undefined;
  kind?: 'session' | 'pitch';
}): string {
  return rec.label?.trim() || autoTitle(rec);
}

/** True when the name is one this app made up, and the rep might want a better one. */
export function isAutoTitled(rec: { label?: string | null }): boolean {
  return !rec.label || !rec.label.trim();
}
