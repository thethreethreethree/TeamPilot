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
 * What a re-read cost, on top of what it achieved.
 *
 * `timingLost` means the words are back and this call's TIMING is gone, permanently. The server
 * detects it by reading its own write back, and until 11 September it recorded that only in a log
 * line and a database row - so the person who asked was told it worked and never told what it
 * cost. Three real calls went that way on 10 September inside sixty seconds.
 *
 * It is not a small loss and it is not recoverable: `spoken_at` is what the pace skill reads, and
 * the one-attempt marker is deliberately not released, so nothing will revisit the call later.
 */
export type RecoveryResult = { status: RecoveryStatus; timingLost: boolean };

/**
 * The extra sentence when a recovery succeeded but cost this call its timing.
 *
 * SEPARATE FROM `recoveryWording`, because it is not an alternative to the outcome - it is an
 * addition to it. The words really did come back, and saying only "something was lost" would be as
 * wrong in the other direction as saying only "it worked" was.
 *
 * NO BLAME AND NO JARGON. A rep did not cause this and cannot fix it; it is a database update
 * their company has not applied yet. What they can do is know that this one call will not have a
 * pace reading, so they are not left wondering later why it is the only one without.
 */
export const TIMING_LOST_NOTE =
  'One thing did not come back: how this call was paced. Your words and the customer' +
  '’s are all here, but the timing behind them was lost on the way, so this call will not ' +
  'get a speed reading. Nothing you did caused it and there is nothing to redo.';

/**
 * WHAT A RE-READ CAN COST, SAID BEFORE IT IS SPENT AND NOT AFTER.
 *
 * `TIMING_LOST_NOTE` explains the loss once it has happened. That is the wrong moment to learn
 * about it and it took shipping the button to see it: a recovery started today can permanently
 * cost the call its pacing, the rep is told so afterwards, and there is no undo. An action whose
 * price is disclosed only after payment is not a choice the person made.
 *
 * WHY IT CAN HAPPEN AT ALL. The timing lives in a column the recovery writes, and the migration
 * that protects it is pending on this product's database. Both versions of the write succeed and
 * both report a count, so nothing looks wrong from here - and the recovery deliberately never
 * retries, correctly, because retrying would re-run a paid transcription every hour for something
 * only an administrator can fix. So for that call the loss is permanent.
 *
 * WRITTEN TO STAY TRUE AFTER THE FIX, because a warning that goes stale is its own defect and this
 * app has paid for that before. It states a possibility rather than a certainty, and it never
 * mentions a migration: the person tapping is a rep who cannot apply one and should not have to
 * know the word. Once the database is fixed the risk simply stops materialising, and the sentence
 * remains accurate rather than becoming a lie.
 *
 * NOT SHOWN AS A WARNING STRIPE. The recovery is still the right thing to do for a call that
 * otherwise has nothing at all - words without pacing beat silence. This informs the tap; it does
 * not argue against it.
 */
export const RECOVERY_COST_NOTE =
  'This can cost the call its speed reading. The words come back either way; the timing behind ' +
  'them - who spoke when - sometimes does not, and that part cannot be recovered later. ' +
  'Everything else about the call is unaffected, and you will be told if it happened.';

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
