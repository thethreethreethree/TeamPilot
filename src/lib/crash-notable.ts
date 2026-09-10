/**
 * Which CAUGHT failures are worth putting in the crash log.
 *
 * THE GAP THIS CLOSES. `Report a problem` records what an error boundary
 * catches — a screen that threw. But this app almost never throws at a rep: it
 * catches, classifies, and shows a sentence. So the failures a rep actually
 * experiences leave no trace, and the screen would say "nothing has been
 * recorded on this phone" to somebody who has just watched four uploads fail.
 * A crash log that is empty exactly when it is opened is worse than no crash
 * log, because it is evidence of nothing having gone wrong.
 *
 * BUT NOT EVERY FAILURE, and this is the whole design. A rep works in dead
 * zones. If every dropped request were recorded, the twenty slots would be full
 * of "the network was down" within one afternoon, and the one entry that mattered
 * would have been pushed out by noise. A log nobody can read is the same as no
 * log — the second failure mode of the pair, and easier to walk into.
 *
 * THE RULE: record a failure only when RETRYING CANNOT FIX IT.
 *
 *   transient    NEVER. A dead connection is the normal condition of this job.
 *                The outbox retries by design and the rep needs no report.
 *   conflict     NEVER. It means the server already has this — the right
 *                outcome reached by a wasteful route. Nothing is wrong.
 *   needs-shim   ALWAYS. The server refuses this kind of write at all. The rep
 *                can do nothing, the outbox will retry forever, and today
 *                NOBODY who could deploy the fix ever finds out. This is the
 *                single most valuable thing this log can carry.
 *   rejected     ALWAYS. The server considered it and said no. Either the rep
 *                did something the app should have prevented, or the app sent
 *                something wrong. Both are defects; neither is visible.
 *
 * PURE, so the rule can be tested and so a change to it breaks a named test
 * rather than quietly changing what a rep's phone remembers.
 */
import type { SendOutcome } from './sync/outbox-classify';

/** The reasons that survive to the log. Named so the test can assert the SET. */
export const RECORDED_REASONS = ['needs-shim', 'rejected'] as const;

export type RecordedReason = (typeof RECORDED_REASONS)[number];

/**
 * Should this attempt leave a trace?
 *
 * Takes the whole outcome rather than the reason string on purpose: a successful
 * outcome has no `reason` field at all, and a function that could be handed
 * `undefined` and answer "yes" is the shape that fills a log with nothing.
 */
export function shouldRecord(outcome: SendOutcome): boolean {
  if (outcome.ok) return false;
  return (RECORDED_REASONS as readonly string[]).includes(outcome.reason);
}

/**
 * What the entry says, in words that mean something to whoever reads the report.
 *
 * `subject` is what was being sent — "a knock", "a recording" — because "send
 * failed" in a list of twenty tells nobody which part of the app to look at.
 *
 * The server's own message is appended when there is one. It is scrubbed later,
 * on the way into the entry, by the same rules everything else passes.
 */
export function noteFor(outcome: SendOutcome, subject: string): string {
  if (outcome.ok) throw new Error('noteFor was given a success');
  const server = outcome.message?.trim();
  /**
   * NOT "THIS NEEDS A DEPLOY", which is what this said until 4 September.
   *
   * That was written when several coach routes were still cookie-only, so a
   * 401/403/404 from a queued write really did mean the shim was not live. It is
   * not true any more — all five routes these writes use resolve a mobile Bearer
   * token, swept and confirmed against the web repository that day.
   *
   * It matters more here than on a screen, because this sentence goes into a
   * PROBLEM REPORT. Naming the wrong cause sends whoever reads it looking at
   * deployments when the answer is an expired session, an account without a
   * company, or a session row that is not there. So it now says what is
   * certainly true — the server refused it and kept refusing — and stops.
   */
  const head =
    outcome.reason === 'needs-shim'
      ? `The server would not accept ${subject} at all, and went on refusing. Retrying will not help; somebody needs to look at why it is being turned down.`
      : `The server turned down ${subject}.`;
  return server ? `${head} It said: ${server}` : head;
}

/** Where the entry says it came from. Kept short — it is a row title. */
export function whereFor(subject: string): string {
  return `Sending ${subject}`;
}

/**
 * What each queued write is, in the rep's language rather than the schema's.
 *
 * `outcome` and `rename` are the words the outbox uses internally. Neither means
 * anything to the person reading the report — and "rename failed" would send
 * whoever debugs it looking for a rename feature, which is not what this is: it
 * is the name a rep types onto a call after the fact.
 */
export function subjectOfKind(kind: 'outcome' | 'rename'): string {
  return kind === 'outcome' ? 'how a call went' : "the name on a call";
}

/**
 * The same question for a RECORDING upload, which has its own vocabulary.
 *
 * A queued outcome is a hundred bytes and can be retyped. A recording is the
 * only copy of a real conversation with a real customer, so the stakes here are
 * not the same and the rule is not the same either.
 *
 *   needs-shim   RECORD. The server refuses uploads. Every recording on every
 *                phone is stuck behind this and nobody upstream knows.
 *   file-gone    RECORD, and this is the worst thing this app can do. The audio
 *                was not there when the sweep went to send it. That call is
 *                gone and cannot be recovered by anyone. If it ever happens, the
 *                person who can fix it needs to hear about it.
 *   too-large    RECORD. The rep is told, so it is not invisible to THEM — but
 *                it means a real conversation can never be sent, and nobody
 *                setting the limit ever learns it is costing calls.
 *   not-ready    NEVER. A queued pitch with no outcome yet. The rep fixes this
 *                by finishing what they started; it is not a defect.
 *   failed       NEVER. The ordinary failure, retried next sweep. This is the
 *                dead-zone case and recording it would drown the log.
 */
export type UploadFailReason = 'needs-shim' | 'too-large' | 'file-gone' | 'not-ready' | 'failed';

export const RECORDED_UPLOAD_REASONS = ['needs-shim', 'file-gone', 'too-large'] as const;

export function shouldRecordUpload(reason: UploadFailReason): boolean {
  return (RECORDED_UPLOAD_REASONS as readonly string[]).includes(reason);
}

/**
 * What the entry says about a recording that could not be sent.
 *
 * Written for two readers at once: whoever debugs it, and the rep who reads the
 * row before pressing send. Neither is served by "upload failed".
 */
export function uploadNoteFor(reason: UploadFailReason, label: string | null): string {
  const which = label && label.trim() ? `“${label.trim()}”` : 'an unnamed call';
  switch (reason) {
    case 'needs-shim':
      // Same correction as `noteFor` above: the upload routes take a Bearer
      // token, so this is no longer evidence of a missing deploy.
      return `The server would not accept recordings at all, so ${which} is still waiting. Retrying will not help; somebody needs to look at why it is being turned down.`;
    case 'file-gone':
      return `The audio for ${which} was gone before it could be sent. That recording cannot be recovered.`;
    case 'too-large':
      return `${which} is over the size the server will accept, so it can never be sent as it is.`;
    default:
      // Unreachable through `shouldRecordUpload`, and deliberately not thrown:
      // this runs inside a background sweep, and a crash recorder that throws
      // takes the sweep down with it.
      return `${which} could not be sent (${reason}).`;
  }
}
