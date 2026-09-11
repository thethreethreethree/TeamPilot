/**
 * A short coaching guide for one skill, as the phone shows it.
 *
 * WHY IT BELONGS ON A PHONE. Training names what a rep should work on. Until
 * now the phone could only say the words and offer a practice; the website also
 * offers "Learn" — a guide written from the COMPANY'S own methodology, not
 * generic advice. That is the half a rep can use standing outside a door: what
 * the skill is, what to actually do, what usually goes wrong, and lines they can
 * adapt.
 *
 * EVERY FIELD IS OPTIONAL IN PRACTICE, and the route says so: a malformed or
 * empty generation returns `{material: null}` deliberately, and the website
 * shows an honest empty rather than inventing filler. So does this.
 *
 * A GUIDE WITH NOTHING IN IT IS NOT A GUIDE. If every list comes back empty and
 * there is no overview, this reports it as absent rather than rendering four
 * empty headings — which reads as a broken screen rather than a coach that had
 * nothing to add.
 */

export type CoachingMaterial = {
  /** One or two sentences: what this skill is and why it matters. */
  overview: string;
  /** Two to four concrete things to do. */
  keyMoves: string[];
  /** One to three common mistakes. */
  watchOuts: string[];
  /** One to three strong phrasings the rep can adapt. */
  exampleLines: string[];
};

function lines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
}

/**
 * Read what the route sent, keeping only what can actually be shown.
 *
 * Returns null for anything unusable, so the screen has one thing to check.
 */
export function readCoachingMaterial(payload: unknown): CoachingMaterial | null {
  const raw = (payload as { material?: unknown } | null)?.material;
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const material: CoachingMaterial = {
    overview: typeof m.overview === 'string' ? m.overview.trim() : '',
    keyMoves: lines(m.keyMoves),
    watchOuts: lines(m.watchOuts),
    exampleLines: lines(m.exampleLines),
  };
  const empty =
    !material.overview &&
    material.keyMoves.length === 0 &&
    material.watchOuts.length === 0 &&
    material.exampleLines.length === 0;
  return empty ? null : material;
}

/** What the screen says when the coach had nothing to add. Never blames the rep. */
export const NO_MATERIAL =
  'The coach has nothing written up for this one yet. Practicing it still works.';

/**
 * What the screen says when the REQUEST could not be made at all.
 *
 * NOT THE SAME SENTENCE AS "nothing written up", and the difference matters:
 * telling a rep "the coach has nothing for this" when the request never
 * succeeded is a lie about their coach, and the sort they would carry into a
 * conversation with their manager.
 *
 * THE OLD SENTENCE WAS ITSELF A LIE, corrected 4 September. It read "This guide
 * needs a change on the website that has not gone live yet" — a claim written
 * when `coaching-material` was the last cookie-only route. It is not any more:
 * the route resolves `resolveApiAuth`, "web cookie OR mobile Bearer (native app
 * reuses this route)", checked in that repository rather than assumed. So the
 * app was telling reps to wait for a deploy that had already happened, which is
 * the worst kind of wrong — it is unfalsifiable from the rep's side and they
 * simply stop asking.
 *
 * `blockedState` now writes it, which also splits the two cases the old single
 * sentence flattened: a session that has expired, and a route that refused a
 * live token. One is fixed by signing in; the other cannot be fixed by the rep
 * at all.
 */
export { blockedState } from './blocked-state';

/**
 * What the rep can still do, appended to whichever blocked sentence applies.
 *
 * KEPT WHEN THE REST WAS REPLACED, and only because a test caught its loss. The
 * old sentence ended "Practising the skill works now", and switching to the
 * shared blocked paragraph dropped it — trading a true reason for a lost
 * reassurance. Both belong: the rep needs to know why the guide is missing AND
 * that the thing they came here to do is unaffected.
 */
export const MATERIAL_STILL_WORKS = 'Practicing the skill works now.';

/** The whole sentence for a guide that could not be fetched. */
export function materialUnavailable(body: string): string {
  return `${body} ${MATERIAL_STILL_WORKS}`;
}

/**
 * True when a failure means the request did not succeed, rather than "the coach
 * has nothing to say about this".
 *
 * 401/403/404 all land here and are NOT the same thing — which is why the caller
 * pairs this with `authFailureOf` and lets `blockedState` say which. This
 * function answers only "was there an answer at all".
 */
export function isUnavailable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403 || status === 404;
}
