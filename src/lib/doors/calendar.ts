/**
 * The month grid behind the date picker — arithmetic only, no React.
 *
 * WHY THIS IS NOT A LIBRARY. `@react-native-community/datetimepicker` is the
 * obvious answer and it is a NATIVE module: a new pod, a new config plugin, and
 * a rebuild of a binary that a native plugin has already broken once on this
 * project. A from/to pair on a KPI screen is not worth spending a build failure
 * on, and the arithmetic underneath a calendar is four functions that a test can
 * hold still. The screen keeps the platform's look through tokens and 44pt
 * targets, not through the platform's widget.
 *
 * WHY IT IS NOT IN THE COMPONENT. A calendar has exactly the kind of bug that a
 * screenshot cannot show: a month whose first day is a Sunday, a February in a
 * leap year, a grid that silently drops the 31st. Those are answers, and answers
 * belong where a test can ask for them.
 *
 * EVERY DATE IS HANDLED AT UTC NOON. Building `new Date('2026-09-01')` and then
 * reading local getters is how a calendar in a negative-offset timezone renders
 * the 31st of August as its first cell. Noon is far enough from both midnights
 * that no offset in use can cross a day boundary.
 *
 * THE WEEK STARTS ON MONDAY, matching the `en-GB` locale the rest of this app
 * formats with (see `dateEyebrow`), and matching the door week a rep works.
 */

/** One cell of the grid. `null` is a leading or trailing blank, not a day. */
export type DayCell = string | null;

/** Monday first, matching en-GB. Short enough to fit seven across a phone. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** A calendar day as the API wants it. `month` is 1-12, not a JS month index. */
export function isoOf(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** The year and 1-12 month of an ISO day, or null when it is not one. */
export function monthOf(iso: string | null | undefined): { year: number; month: number } | null {
  const s = (iso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** How many days that month has. Leap years included, by construction. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the NEXT month is the last day of this one, so the calendar's own
  // rules answer the leap-year question rather than a table of lengths.
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

/** Move a month by `delta`, rolling the year. December + 1 is next January. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (((zero % 12) + 12) % 12) + 1 };
}

/**
 * The weeks of a month, Monday first, padded with nulls at both ends.
 *
 * Adjacent months' days are BLANK rather than tappable. A rep who taps "1" in a
 * dimmed trailing row and lands in the next month has moved their window without
 * meaning to, and on a from/to pair that error is invisible afterwards.
 */
export function monthGrid(year: number, month: number): DayCell[][] {
  const total = daysInMonth(year, month);
  // getUTCDay is Sunday-0; shift so Monday is 0.
  const lead = (new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay() + 6) % 7;
  const cells: DayCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(isoOf(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "September 2026" — the caption over the grid. */
export function monthLabel(year: number, month: number, locale = 'en-GB'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  } catch {
    return `${month}/${year}`;
  }
}

/** "4 Sep 2026" — how a chosen day reads back on the chip. */
export function dayLabel(iso: string, locale = 'en-GB'): string {
  const m = monthOf(iso);
  if (!m) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}

/** How a day is announced when a screen reader lands on it. */
export function daySpoken(iso: string, locale = 'en-GB'): string {
  const m = monthOf(iso);
  if (!m) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}

/** The day number to draw in a cell. */
export function dayNumber(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}
