/**
 * Turning a transcript into the text the coach reads.
 *
 * WHY IT IS BOUNDED. A transcript is now read completely rather than stopping at
 * the server's row cap, so a two-hour appointment can be tens of thousands of
 * words — more than the model accepts, more than a phone should hold in an
 * editable field, and more than a rep wants to scroll past to edit.
 *
 * WHY IT KEEPS THE END. A question about a call is almost always about how it
 * finished: the objection, the hesitation, the close. Keeping the opening and
 * dropping the ending would remove the part being asked about.
 *
 * WHY THE CUT IS LABELLED. This is the difference between a bound and a lie. A
 * rep who can see that the first 340 lines are missing can paste them back or
 * ask a narrower question. A rep who cannot would get an answer about the last
 * twenty minutes while believing it covered the whole conversation, with nothing
 * in the reply to reveal it.
 */

/** One line of transcript, as far as this module is concerned. */
export type PrefillSegment = { speaker: string; text: string };

/**
 * Roughly 4,000 words. Comfortably inside what the model accepts, small enough
 * for a phone to hold in an editable field, and long enough to cover the part of
 * a call anyone asks about.
 */
export const PREFILL_MAX_CHARS = 24_000;

function speakerName(speaker: string): string {
  if (speaker === 'agent') return 'Me';
  if (speaker === 'customer') return 'Customer';
  return 'Unclear';
}

export function transcriptForCoach(
  segments: PrefillSegment[],
  maxChars: number = PREFILL_MAX_CHARS,
): string {
  const lines = segments.map((seg) => `${speakerName(seg.speaker)}: ${seg.text}`);
  if (lines.length === 0) return '';

  /**
   * An UNATTRIBUTED transcript, said out loud.
   *
   * Until a rep answers "which voice is you?", every line comes back as
   * `unknown` and renders as "Unclear:". Handed that without comment, the coach
   * answers as though it knows who said what — and its advice about handling an
   * objection may be advice about a sentence the REP said. Nothing in the reply
   * would reveal it.
   *
   * So the transcript says what it is. The coach can then reason about the
   * conversation without assuming sides, and the rep can see why the answer is
   * hedged rather than concluding the coach is vague.
   */
  const attributed = segments.some(
    (seg) => seg.speaker === 'agent' || seg.speaker === 'customer',
  );
  const preamble = attributed
    ? null
    : '[Nobody has said which voice is the salesperson, so these lines are not attributed. Do not assume who said what.]';

  // Walk backwards from the end of the call, keeping lines until the budget runs
  // out. Counted in CHARACTERS rather than lines because one rambling answer can
  // be longer than fifty short exchanges — a line count would keep a wildly
  // different amount of conversation depending on how people happened to talk.
  const kept: string[] = [];
  let size = 0;
  let dropped = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    size += lines[i].length + 1;
    // `kept.length > 0` guarantees at least one line survives: a single spoken
    // turn longer than the whole budget must still reach the coach, because an
    // empty box would look like the transcript failed to load.
    if (size > maxChars && kept.length > 0) {
      dropped = i + 1;
      break;
    }
    kept.unshift(lines[i]);
  }

  // Both notices are collected, then emitted together. Two separate early
  // returns would mean a long UNATTRIBUTED call reported only the trim and
  // silently dropped the more important warning.
  const notices = [
    dropped > 0
      ? `[The first ${dropped} ${dropped === 1 ? 'line' : 'lines'} of this call are not included here — this is how it ended. Paste any earlier part you want the coach to read.]`
      : null,
    preamble,
  ].filter((n): n is string => n !== null);

  if (notices.length === 0) return kept.join('\n');
  return [...notices, '', ...kept].join('\n');
}

/**
 * Bound the text actually SENT to the coach, without touching what the rep sees.
 *
 * WHY THIS IS SEPARATE FROM THE PREFILL. That one shapes a transcript before the
 * rep ever looks at it. This one runs at the moment of asking, on text they may
 * have typed, pasted or grown by using "Used it — what next?" several times over
 * a long doorstep conversation. Their box keeps everything; the request cannot.
 *
 * WHY IT NEVER EDITS THE BOX. Silently deleting words a person typed is a
 * different and worse thing than shortening a transcript the app itself
 * assembled. The rep keeps their full text, and the screen says what was sent.
 *
 * Cuts on a line boundary so the coach never receives half a sentence with no
 * indication it was cut mid-word.
 */
export function conversationForRequest(
  text: string,
  maxChars: number = PREFILL_MAX_CHARS,
): { text: string; droppedLines: number } {
  if (text.length <= maxChars) return { text, droppedLines: 0 };

  const lines = text.split('\n');
  const kept: string[] = [];
  let size = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    size += lines[i].length + 1;
    // At least one line always survives, for the same reason as the prefill: an
    // empty request would look like the app lost what they typed.
    if (size > maxChars && kept.length > 0) {
      return { text: kept.join('\n'), droppedLines: i + 1 };
    }
    kept.unshift(lines[i]);
  }

  return { text: kept.join('\n'), droppedLines: 0 };
}
