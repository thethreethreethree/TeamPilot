/**
 * Re-reading a call whose customer side was never captured — what the outcomes MEAN.
 *
 * WHY A REP EVER SEES THIS. Some calls come back with only one voice in the transcript: the mic
 * caught the rep and not the person at the door. The coach then has no conversation to read, so the
 * debrief is blank — and until now the app called that a failed write-up and offered to build it
 * again, which re-runs the same write-up over the same one-sided transcript and comes back blank
 * every time, at a real cost per tap. `after-pitch-empty.ts` now tells the two apart; this file
 * covers what happens when the rep asks for the thing that CAN work.
 *
 * SEVEN OUTCOMES, NOT TWO. The server distinguishes them carefully and the app used to have no way
 * to see the difference — `canonical` and `no-audio` both arrive as HTTP 409, and one is good news
 * while the other is a dead end. Collapsing them into "something went wrong" would be the exact
 * failure this codebase exists to avoid: an absence with a confident wrong reason attached.
 *
 * PURE, so the sentences can be read side by side and tested. `after-pitch.ts` does the network
 * call and imports these; it cannot be tested itself, because it reaches a native module.
 */

/** Every status the re-read route can answer with. Named as the server names them. */
export const RECOVERY_STATUSES = [
  'recovered',
  'saved-unlabelled',
  'still-one-sided',
  'could-not-decide',
  'canonical',
  'no-audio',
  'already-attempted',
  'failed',
] as const;

export type RecoveryStatus = (typeof RECOVERY_STATUSES)[number];

/**
 * Is this one of the statuses we know?
 *
 * A guard rather than a cast, because the string arrives from the network. A status the server
 * starts sending that this app has never heard of must fall through to the honest failure sentence
 * rather than render as a blank space where an explanation should be.
 */
export function isRecoveryStatus(value: unknown): value is RecoveryStatus {
  return typeof value === 'string' && (RECOVERY_STATUSES as readonly string[]).includes(value);
}

/**
 * Did the words come back?
 *
 * Both of these mean the transcript on the server is now two-sided, so the card should rebuild the
 * read rather than say anything at all. `canonical` is the case where a previous attempt already
 * succeeded and only this phone did not know it yet.
 */
export function recoveryRecoveredWords(status: RecoveryStatus): boolean {
  return status === 'recovered' || status === 'canonical';
}

/**
 * Is it worth offering the button again?
 *
 * ONLY for a genuine outage. Every other terminal is settled: asking again would re-run the same
 * work on the same audio and reach the same place, and each attempt is a speech-to-text charge.
 * This is the rule two other cards in this app arrived at the hard way — a failed retry that
 * re-offers an identical button is an invitation to keep paying for the same nothing.
 */
export function canAskAgain(status: RecoveryStatus): boolean {
  return status === 'failed';
}

/**
 * What the rep reads after a re-read that did not simply work.
 *
 * Null for the two statuses that recovered the words, because there the card has a real read to
 * show and a sentence about the mechanics would be noise over the top of it.
 */
export function recoveryWording(status: RecoveryStatus): { title: string; body: string } | null {
  switch (status) {
    case 'recovered':
    case 'canonical':
      return null;

    case 'saved-unlabelled':
      // NOT a failure, and it must not read like one: the words are safe. All that is missing is
      // which voice is which, and this app already has the one-tap card that asks exactly that.
      return {
        title: 'The words are back — one question left',
        body: 'Both sides of the conversation were recovered and saved. The system could not be sure which voice is yours, so it will ask you to say which, and the read is built from there.',
      };

    case 'still-one-sided':
      return {
        title: 'The recording really does hold one voice',
        body: 'It was read again from the audio and there is genuinely only one person on it. Nothing was lost in the writing down — the second voice was never on the recording. If the customer was speaking, the phone was too far from them to hear it.',
      };

    case 'could-not-decide':
      return {
        title: 'It could not separate the voices',
        body: 'The recording was read again but the speakers could not be told apart with confidence, so nothing was changed rather than something wrong being saved. Your recording and your existing transcript are untouched.',
      };

    case 'no-audio':
      return {
        title: 'There is no saved recording for this call',
        body: 'Re-reading works from the audio, and this call has none stored — so there is nothing further to recover. The words already in the transcript are all there is.',
      };

    case 'already-attempted':
      return {
        title: 'This one has already been re-read',
        body: 'The recording was read a second time before, and this is the result it produced. Asking again would run the same work over the same audio and reach the same place.',
      };

    case 'failed':
      // The only one worth offering again — see canAskAgain. The audio is safe in every branch of
      // the server's failure handling, and saying so is the thing a rep actually wants to know.
      return {
        title: 'The re-read did not finish',
        body: 'Something went wrong partway through and nothing was changed. Your recording is safe and so is everything already saved for this call. It is worth trying once more.',
      };
  }
}
