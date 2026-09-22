/**
 * The period toggle — its words, and the check that the server actually honoured it.
 *
 * ONE SELECTION ACROSS BOTH BOARDS (guide Step 2: *"The period selection carries across Progress
 * and Breakdown"*). They are two views of one period; fetching them independently would let them
 * disagree while a rep switched between them, and the rep would have no way to tell which was
 * stale.
 *
 * ── THE GUARD, AND WHY IT IS NOT PARANOIA ──────────────────────────────────────────────────────
 *
 * `/pitch-score/breakdown` resolves its period like this [OBSERVED, route line 58]:
 *
 *     const period = PERIODS.includes(raw) ? raw : "week";
 *
 * An unrecognised value does not fail. It returns **this week**, with `period: "week"` in the body,
 * and a board that ignores that field renders seven days of work under whatever label the rep
 * tapped. This app has met this exact shape before: the door metrics range endpoint answers **200**
 * to a reversed date range and returns TODAY, which `metrics-range.ts` guards for the same reason —
 * *"eight doors labelled as ten days' work"*.
 *
 * The hazard here is live, not theoretical. This app ALREADY has a period vocabulary:
 * `src/lib/doors/metrics-view.ts` exports `day | week | month | **all_time**`. The Pitch Score API
 * speaks `day | week | month | **all**`. Wire the existing one to these routes — an entirely
 * reasonable thing for the next person to do, since both are "the period toggle" — and *All time*
 * silently becomes *this week*, captioned "All time", with nothing in the UI wrong.
 *
 * So the response's own `period` is checked against what was asked. It costs one comparison and it
 * converts a confident wrong number into a visible one.
 */

/** The four periods the Pitch Score API accepts, spelled as the server spells them. */
export const PERIODS = ['day', 'week', 'month', 'all'] as const;
export type Period = (typeof PERIODS)[number];

/** The default. Matches the breakdown route's own fallback, so first paint and server agree. */
export const DEFAULT_PERIOD: Period = 'week';

/**
 * The toggle's words, from the mockup's own control.
 *
 * "All time" is two words on the board and `all` on the wire. Keeping the label beside the key here
 * is what stops a screen inventing `all_time` from the label and getting silently downgraded.
 */
export const PERIOD_LABELS: Record<Period, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  all: 'All time',
};

/** Is this one of the four? A guard rather than a cast — the value can come from stored state. */
export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

/**
 * Did the server answer the period that was asked for?
 *
 * FALSE MEANS DO NOT LABEL THESE FIGURES WITH THE ASKED PERIOD. It does not mean the numbers are
 * junk — they are a real aggregate of a real window — it means they are a different window from the
 * one on the button, and presenting them under it is the lie.
 *
 * A response with no `period` field at all reads as NOT honoured. An older server that does not
 * echo the field is indistinguishable, from here, from one that quietly substituted — and between
 * those two readings the cautious one costs a caption while the trusting one costs a wrong number.
 */
export function periodHonoured(asked: Period, response: unknown): boolean {
  const echoed = (response as { period?: unknown } | null)?.period;
  return echoed === asked;
}

/**
 * What to say when it was not honoured.
 *
 * Names the window the figures ACTUALLY cover when the server said which, because "these numbers
 * are not what you asked for" leaves a rep unable to use them at all, and they are perfectly usable
 * once they are labelled truthfully.
 */
export function periodSubstituted(asked: Period, response: unknown): string {
  const echoed = (response as { period?: unknown } | null)?.period;
  const actual = isPeriod(echoed) ? PERIOD_LABELS[echoed].toLowerCase() : null;
  return actual
    ? `These are your ${actual} figures, not ${PERIOD_LABELS[asked].toLowerCase()} — the server did not have that window.`
    : `The server did not say which period these figures cover, so they are not labelled ${PERIOD_LABELS[asked].toLowerCase()}.`;
}
