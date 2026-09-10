import type { AfterPitch } from '@/lib/after-pitch';

/**
 * WHY there is nothing to show in a debrief — because the two reasons need opposite
 * sentences, and the app gave the same one to both.
 *
 * THE WRONG SENTENCE THIS REMOVES. An empty debrief always said: *"There was not enough of
 * a conversation here for the coach to say anything useful. That is a fact about the call,
 * not about you."* Kind, and for most of these calls false.
 *
 * Measured on production 10 September 2026: of the 168 sessions the coaching engines can
 * read, 56 ran and produced nothing — and they are systematically the LONGER calls, median
 * 683 words against 362 for the ones that succeeded. So the app was telling a rep that their
 * 683-word conversation was not enough of a conversation. It is the same failure this app
 * spends real effort avoiding everywhere else — an absence explained with a confident wrong
 * reason — except this one lands on the rep, about their own work.
 *
 * SCORES ARE THE DISCRIMINATOR IN ONE DIRECTION ONLY, and that took a second measurement to see. A
 * score means the call WAS substantial enough to measure, so a blank write-up on a scored call is the
 * write-up failing. That half holds. THE CONVERSE DOES NOT: no score does not mean the call was thin.
 *
 * Measured 2026-09-11, in the founder's own company: 12 sessions carry 100+ words FROM THE REP and no
 * scores at all, the largest of them 757 words. Every one of those was being told "there was not enough
 * of a conversation here" — the same false sentence this file was created to remove, one branch over.
 *
 * AND THERE IS NO LENGTH THRESHOLD THAT WOULD FIX IT. Across every company: the smallest call that DID
 * get scored has ONE rep word; the largest that did NOT has 1,153. Scoring succeeds or fails for reasons
 * that have nothing to do with how much was said, so no word count can separate "thin" from "the scoring
 * failed" — which is exactly why the honest answer is to stop claiming to know which.
 *
 * IT LIVES IN ITS OWN FILE for the reason this codebase already records: `after-pitch.ts`
 * imports the network client, which reaches `expo/fetch` — a native module that cannot load
 * under plain Node — so a rule left in there cannot be tested at all. The `AfterPitch` import
 * here is TYPE-ONLY and erased at runtime, so nothing native comes with it.
 */

export type EmptyReadReason =
  /** Nothing has been written for this call yet — offer to write it. */
  | 'none'
  /** Scored, so there was plenty to say, and the write-up came back empty. Rebuilding works. */
  | 'engine-blank'
  /**
   * No scores and no write-up, and NOTHING RECORDS WHICH of the two reasons it is: little in the call,
   * or the scoring itself failing. Named for what is observed rather than for a cause we cannot see —
   * it used to be called `thin`, which was a claim, and the claim was wrong for 12 of the founder's own
   * sessions, the largest of them 757 words.
   */
  | 'unexplained'
  /**
   * The CUSTOMER's side of this call carries no words at all, so a rebuild cannot help.
   *
   * THE BUTTON THIS TAKES AWAY IS THE POINT. This case HAS scores - `talk_ratio`, carrying its
   * data-capture caveat, and `question_rate` are both computed from the agent side alone - so
   * `emptyReadReason` classified it as `engine-blank` and the card offered "Build it again".
   * Rebuilding re-runs the write-up over the SAME one-sided transcript and comes back blank every
   * time. The website's own recovery code says so in as many words: a heal "just re-runs the LLM on
   * the SAME one-sided transcript and stays blank". So the phone was offering a rep a button that
   * could not work, and every tap of it is a real charge.
   *
   * WHAT DOES WORK is re-reading the saved recording, which recovers the missing side. That is a
   * different action with a different name, and it is what the card offers here instead.
   */
  | 'customer-missing'
  /**
   * The rep asked for a rebuild in THIS sitting and it came back empty again.
   *
   * Without this the card put the same message and the same button back, saying nothing about the
   * attempt that had just run - so a rep taps forever, and each tap is a real charge. The same defect
   * was found and fixed on the read card an hour earlier; this is the other place it lived.
   */
  | 'retried-and-failed';

/**
 * Is there anything in this debrief worth drawing?
 *
 * THE ONE COPY. It lived in `after-pitch.ts`, which imports the network client and so cannot
 * be loaded in a test at all. Moving it here rather than copying it was deliberate: this
 * project has already paid for a duplicated rule — a band threshold kept in two places told
 * one rep they were "Elite" on one screen and "Strong" on another, because only one copy
 * rounded. Two copies of a rule always pass their own tests; the only symptom is that the
 * files disagree. `after-pitch.ts` re-exports this, so every existing caller is unchanged.
 */
export function hasContent(summary: AfterPitch | null): boolean {
  if (!summary) return false;
  if (summary.hasSignal === false && summary.narrative?.hasSignal === false) return false;
  return (
    (summary.narrative?.strengths?.length ?? 0) > 0 ||
    (summary.narrative?.growthAreas?.length ?? 0) > 0 ||
    Boolean(summary.focus)
  );
}

/**
 * Was the customer's side of this call never captured?
 *
 * The signal is the `talk_ratio` score's caveat, which the scoring engine sets when the customer
 * side carries zero transcribed words. It is deliberately NOT "there are no scores": this case has
 * two of them, which is precisely why it was being misread as a write-up failure.
 *
 * Mirrors `detectCaptureGap` in the website's `src/lib/coach/v5/captureGap.ts`, which is the source
 * of truth. The rule is restated rather than shared because the two codebases cannot import from
 * each other - so it is stated once per codebase, and the test names the file it has to track.
 */
export function customerSideMissing(summary: AfterPitch | null): boolean {
  return Boolean(summary?.scores?.some((s) => s.key === 'talk_ratio' && s.caveat === true));
}

/** Null when there IS something to show, so a caller can use it as the condition itself. */
export function emptyReadReason(
  summary: AfterPitch | null,
  /** The rep rebuilt it in this sitting and it still came back with nothing. */
  justTried?: boolean,
): EmptyReadReason | null {
  if (!summary) return justTried ? 'retried-and-failed' : 'none';
  if (hasContent(summary)) return null;
  /**
   * BEFORE `justTried`, and the ordering is deliberate. The other reasons describe what HAPPENED;
   * this one describes what is WRONG, and that stays true however many times it has been asked. A
   * rep whose re-read failed still needs to know the customer's side was never captured - telling
   * them only "that did not work either" would take the one useful fact off the screen.
   */
  if (customerSideMissing(summary)) return 'customer-missing';
  if (justTried) return 'retried-and-failed';
  return (summary.scores?.length ?? 0) > 0 ? 'engine-blank' : 'unexplained';
}

/**
 * Would re-reading the saved recording help?
 *
 * Only for the one class where the WORDS are missing rather than the write-up: a second pass over
 * the audio recovers the side that was never transcribed. Offering it anywhere else would be a
 * false diagnosis, and a speech-to-text charge for nothing.
 */
export function canReRead(reason: EmptyReadReason | null): boolean {
  return reason === 'customer-missing';
}

/**
 * What the card says, for every reason, in one place.
 *
 * It was a four-branch nested ternary inline in the card, and a fifth branch is where a wrong
 * sentence would have hidden. Every sentence below exists because an earlier one was wrong about a
 * real rep's real call, so they are worth being able to read side by side - and to test.
 */
export function emptyReadWording(reason: EmptyReadReason): { title: string; body: string } {
  switch (reason) {
    case 'retried-and-failed':
      return {
        title: 'That did not work either',
        body:
          'It ran again and still produced nothing. Your recording and your words are safe - the ' +
          'write-up is what failed, and asking again now will most likely do the same. It is ' +
          'worth telling whoever runs your coach.',
      };
    case 'none':
      return {
        title: 'No debrief yet',
        body:
          'Nothing has been written for this call yet. Making one reads the whole conversation, so ' +
          'it takes a moment.',
      };
    case 'customer-missing':
      return {
        title: 'Only your side of this call was recorded',
        body:
          'The customer’s words were not captured, so there is no conversation for the ' +
          'coach to read. That is why this is empty, and why building it again would come back ' +
          'empty too. The recording itself is safe and holds both voices, so it can be read a ' +
          'second time, which usually recovers the missing side.',
      };
    case 'engine-blank':
      // NOT "not enough in this call". This call WAS scored, so there was plenty to say - the
      // write-up is what failed, and rebuilding usually fixes it.
      return {
        title: 'Your read did not come through',
        body:
          'The call was captured and scored, but the coaching write-up came back empty. That is the ' +
          'write-up failing, not the call - try building it again.',
      };
    case 'unexplained':
      // NOT "not enough in this call" either. Measured 2026-09-11: 12 of the founder's own sessions
      // have no scores and 100+ words from the rep, the largest 757 - and no word count separates
      // them, since the smallest call that DID get scored has one word. Nothing records which of the
      // two reasons it is, so the title claims neither.
      return {
        title: 'Nothing came back for this call',
        body:
          'There are no scores and no write-up for this one. That can mean there was little in the ' +
          'call, or that the coach did not finish - nothing recorded which, so I will not guess. ' +
          'Your recording and your words are safe either way.',
      };
  }
}

/**
 * Is there anything a rebuild could still produce?
 *
 * YES FOR `unexplained`, which is the change here and it is not obvious. That case has no scores AND no
 * write-up, and a rebuild runs the scoring engine as well as the narrative - so for a call that has real
 * words and simply never got scored, this button is the only route to either. Measured 2026-09-11 in the
 * founder's own company: 12 sessions carry 100+ words from the rep and no scores at all, the largest 757
 * words. Those twelve had no button at all, on a card that told them nothing came back.
 *
 * NO for `retried-and-failed`. A second identical button after a failed attempt is an invitation to keep
 * paying for the same nothing.
 *
 * NO for `customer-missing`, which is the worse case of the two: that rebuild is not merely unlikely
 * to work, it CANNOT work. The transcript holds one voice, so running the write-up over it again
 * produces the same blank at the same cost, for ever. `canReRead` offers the action that can.
 */
export function canRebuild(reason: EmptyReadReason | null): boolean {
  return reason === 'none' || reason === 'engine-blank' || reason === 'unexplained';
}
