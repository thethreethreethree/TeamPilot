/**
 * A custom from/to window on the door numbers.
 *
 * The presets — day, week, month, all time — answer "how am I doing". A range
 * answers "how did that week go", which is the question asked in a Monday
 * review, and it was the second thing the partner meeting asked for.
 *
 * THE TRAP, MEASURED AGAINST PRODUCTION ON 10 SEPTEMBER, and it is the whole
 * reason this file is not two string concatenations in a screen.
 *
 * The spec says the endpoint "validates the dates match `^\d{4}-\d{2}-\d{2}$` and
 * `from <= to`". It does not. Asked for a REVERSED range it answered **200**, and
 * asked with `from=notadate` it answered **200** — both times with
 * `period: "day"`, `range: null`, and today's figures:
 *
 *     GET ...?from=2026-09-04&to=2026-08-25
 *       -> {"period":"day","range":null,"kpi":{"doorsKnocked":8,...}}
 *
 * So a bad range does not fail. It silently returns TODAY and the screen would
 * caption it with the window the rep asked for — eight doors labelled as ten
 * days' work. That is the confident-wrong-number class this app keeps finding,
 * and here the server hands it over willingly.
 *
 * TWO GUARDS, because either alone leaves the hole open:
 *
 *   1. Do not send a range that is not well-formed and in order.
 *   2. CHECK WHAT CAME BACK. If a range was asked for and the answer says
 *      `period: "day"` or carries no range, the numbers are not the window and
 *      must not be shown as if they were. A client-side check alone assumes the
 *      request survived the trip unchanged, which is the assumption the reversed
 *      range just disproved.
 *
 * PURE, so the rule is tested rather than trusted.
 */

/** A window the rep asked for. Both ends inclusive, both `YYYY-MM-DD`. */
export type DateRange = { from: string; to: string };

/** What the screen is showing: one of the presets, or a custom window. */
export type RangeSelection = { kind: 'preset' } | { kind: 'custom'; range: DateRange };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A real calendar day, not merely a string of the right shape.
 *
 * `2026-02-31` matches the pattern and is not a date. Checked by round-tripping
 * through Date, because a rep spinning a picker can reach a month boundary and a
 * silently-shifted day would move their window without telling them.
 */
export function isCalendarDay(value: string | null | undefined): boolean {
  const s = (value ?? '').trim();
  if (!ISO_DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type RangeProblem = 'incomplete' | 'malformed' | 'reversed' | null;

/**
 * What is wrong with the range the rep has picked so far, if anything.
 *
 * `incomplete` is NOT an error and must not be shown as one — it is the ordinary
 * state between opening the picker and choosing the second date.
 */
export function rangeProblem(from: string | null, to: string | null): RangeProblem {
  const f = (from ?? '').trim();
  const t = (to ?? '').trim();
  if (!f || !t) return 'incomplete';
  if (!isCalendarDay(f) || !isCalendarDay(t)) return 'malformed';
  // Same day is a legitimate one-day window.
  return f > t ? 'reversed' : null;
}

/** True only when the range is safe to send. */
export function isSendableRange(from: string | null, to: string | null): boolean {
  return rangeProblem(from, to) === null;
}

/** The query string for a range. Never called with a range that has not passed. */
export function rangeQuery(range: DateRange): string {
  return `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

/**
 * Did the server actually answer with the window we asked for?
 *
 * THE SECOND GUARD. A reversed or malformed range comes back 200 with
 * `period: "day"` and today's numbers, so the only way to know the answer is the
 * window is to read the echo. A response that does not confirm the range is
 * rejected rather than captioned with it.
 */
export function echoMatchesRange(payload: unknown, asked: DateRange): boolean {
  const o = (payload ?? null) as { period?: unknown; range?: unknown } | null;
  if (!o || o.period !== 'custom') return false;
  const r = o.range as { from?: unknown; to?: unknown } | null;
  if (!r || typeof r.from !== 'string' || typeof r.to !== 'string') return false;
  return r.from === asked.from && r.to === asked.to;
}

/** What the rep reads while they are still choosing. */
export const RANGE_PROMPT = 'Pick a start and an end date.';

/** What they read when the end is before the start. */
export const RANGE_REVERSED = 'The end date is before the start date.';

/** What they read when a date is not a real day. */
export const RANGE_MALFORMED = 'That is not a date the calendar has.';

/**
 * What they read when the server answered with something other than the window.
 *
 * Says plainly that the numbers are NOT being shown, because the alternative is
 * showing today's figures under the heading of a ten-day window.
 */
export const RANGE_NOT_HONOURED =
  'The server did not return that date range, so these numbers are not being shown. Try the range again.';

/** The label on the chip that opens the picker. */
export const CUSTOM_CHIP = 'Custom';

/** How a chosen window reads on screen, e.g. "25 Aug to 4 Sep". */
export function rangeLabel(range: DateRange, format: (iso: string) => string): string {
  return `${format(range.from)} to ${format(range.to)}`;
}
