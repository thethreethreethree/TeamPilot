/**
 * The rep's own scores on the After Pitch summary.
 *
 * THE GAP THIS FILLS is a slightly absurd one. The route already returns
 * `scores` to the session's owner and already strips them for anybody else, and
 * the card already explains to a manager that they were withheld on purpose —
 * but it never rendered them for the rep. The person the scores are FOR was the
 * only person who could not see them.
 *
 * ABSENT IS NOT ZERO, which the card's own header has always said. A missing or
 * unparseable score is dropped rather than drawn as an empty bar, because a bar
 * at zero on a category nobody measured tells a rep they failed at something
 * that was never assessed. That is the same lie the skills view already guards
 * (an unmeasured skill is "not yet", never a D).
 *
 * THE SCALE IS 0-100 and is NOT assumed. The web renders these as a percentage
 * width, so a value outside that range is clamped for the bar while the number
 * itself is shown as it came — a score of 120 is somebody's bug, and hiding it
 * behind a full bar would keep it hidden.
 */

export type RawScore = { label?: string; score?: number };
export type ReadableScore = { label: string; score: number };

/**
 * The scores worth drawing, in the order the coach returned them.
 *
 * Order is preserved rather than sorted: unlike the per-pitch rubric these come
 * back as a considered sequence from the summary itself, and re-ordering them
 * would present the coach's emphasis as something the phone chose.
 */
export function readableScores(scores: RawScore[] | undefined): ReadableScore[] {
  if (!Array.isArray(scores)) return [];
  const out: ReadableScore[] = [];
  for (const s of scores) {
    const label = typeof s?.label === 'string' ? s.label.trim() : '';
    const score = s?.score;
    // Both halves must be real. A labelled category with no number is not a
    // zero, and a number with no label cannot be explained to anybody.
    if (!label || typeof score !== 'number' || !Number.isFinite(score)) continue;
    out.push({ label, score });
  }
  return out;
}

/** Bar width, clamped. The NUMBER shown alongside is never clamped. */
export function barWidth(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

/**
 * Is this score set worth a section at all?
 *
 * An empty list means the summary carried none — for a manager (stripped) or a
 * call too thin to score. Either way the section is not drawn, rather than drawn
 * empty under a heading that promises numbers.
 */
export function hasScores(scores: RawScore[] | undefined): boolean {
  return readableScores(scores).length > 0;
}
