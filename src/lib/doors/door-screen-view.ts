/**
 * What the door home screen says, before any of it is drawn.
 *
 * The screen reads top to bottom: a date, a greeting, WHY today's number is what
 * it is, then the three counts, then the money. The target card sits above the
 * dials deliberately — a rep should read why 80 doors before they read how many
 * of them they have knocked.
 *
 * THE GREETING IS NOT "GOOD MORNING". The 10 September update pinned it to the
 * founder's mockup: a date eyebrow, then "Afternoon, Moses" — part of day only.
 * "Good" was dropped, and it is not an oversight to put back.
 *
 * PURE, so the six states are a tested rule rather than a chain of ternaries in a
 * screen that is hard to get into any of them on purpose.
 */
import { firstNameFrom } from '@/lib/home-view';

/** Which of the screen's states to render. */
export type DoorScreenState =
  | 'loading'
  /** The migration behind this has not rolled out here. Not the rep's problem. */
  | 'unavailable'
  | 'error'
  /** No manager has set this rep a daily sales goal. Nothing can be targeted. */
  | 'no-goal'
  | 'ready';

/**
 * Part of the day, by the device clock.
 *
 * Boundaries at noon and 18:00 — the ordinary English ones. A rep knocking at
 * 17:59 is having an afternoon.
 */
export function partOfDay(now: Date = new Date()): 'Morning' | 'Afternoon' | 'Evening' {
  const h = now.getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

/**
 * "Afternoon, Moses" — or just "Afternoon" when there is no name.
 *
 * NO TRAILING COMMA WITHOUT A NAME. "Afternoon," with nothing after it reads as a
 * bug, and a rep whose profile has not loaded should not be shown one.
 */
export function greeting(
  fullName: string | null | undefined,
  email: string | null | undefined,
  now: Date = new Date(),
): string {
  const first = firstNameFrom(fullName, email);
  const part = partOfDay(now);
  return first ? `${part}, ${first}` : part;
}

/**
 * The date eyebrow, e.g. "Tuesday, 9 September".
 *
 * Built from the LOCAL DATE THE SERVER REPORTED, not from the device clock. The
 * server froze the target against a particular local day, and a phone whose clock
 * has drifted past midnight must not caption yesterday's target with today.
 */
export function dateEyebrow(localDate: string, locale = 'en-GB'): string {
  const s = (localDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    // COMPOSED, not handed to one formatter, because the punctuation is part of
    // the design. `en-GB` renders "Thursday 10 September" with no comma and
    // `en-US` renders "Thursday, September 10" — the mockup says
    // "Tuesday, 9 September", so the parts are formatted and joined here.
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(d);
    const dayMonth = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(d);
    // A MIDDLE DOT, not a comma, and uppercase at the call site. The founder's
    // mockup reads "TUESDAY · 9 SEPTEMBER" in the accent colour - the separator
    // is part of the design, not punctuation left to a formatter. A middle dot
    // is also the one separator the house style allows in generated copy, where
    // em and en dashes are banned.
    return `${weekday} · ${dayMonth}`;
  } catch {
    return '';
  }
}

/**
 * Which state the screen is in.
 *
 * NO-GOAL IS ITS OWN STATE, and it is the one that matters. A rep with no goal is
 * not broken and not loading — a manager has simply not set one, and the only
 * useful thing the screen can do is say so and name who fixes it. Rendering the
 * dials with zero targets instead would show three empty rings and a target of
 * nothing, which reads as "you have achieved none of your goal".
 */
export function doorScreenState(input: {
  loading: boolean;
  failure: 'unavailable' | 'error' | null;
  salesGoal: number | null;
}): DoorScreenState {
  if (input.loading) return 'loading';
  if (input.failure === 'unavailable') return 'unavailable';
  if (input.failure === 'error') return 'error';
  // Null OR non-positive: both mean nobody has set a goal worth targeting.
  if (input.salesGoal === null || input.salesGoal <= 0) return 'no-goal';
  return 'ready';
}

/** The heading over the target sentence. */
export const TARGET_HEADING = "Today's door target";

/** The hint under the dials. */
export const TAP_HINT = 'Tap a dial to log one';

/**
 * The line under the page dots, matching the founder's mockup.
 *
 * IT WAS NOT BUILT AT FIRST, and the reversal is worth recording. The mockup
 * pairs the dots with this hint and nothing else, which would leave page 1
 * reachable by swiping alone - and the design law is explicit that navigation is
 * "never hidden behind a gesture or an unlabelled icon".
 *
 * The founder asked for the mockup exactly, so the resolution is not to drop the
 * dots but to make them CONTROLS: they render identically and each is a button
 * with a real name. The look is the mockup's; the reachability is the law's.
 */
export const SWIPE_HINT = 'Swipe left for the original home screen';

/** What a rep with no goal reads. Names who can fix it, because they cannot. */
export const NO_GOAL_TITLE = 'No daily goal set yet';
export const NO_GOAL_BODY =
  'Your manager sets the daily sales goal this screen works back from. Ask them to set one and your door target appears here.';

/** What everyone reads when this environment has not had the migration. */
export const UNAVAILABLE_TITLE = 'Not available yet';
export const UNAVAILABLE_BODY =
  'The door target is not switched on for this app yet. Nothing you have logged is affected.';

/** The three dials, in the order the funnel actually runs. */
export const DIALS = [
  { key: 'doors', label: 'Doors' },
  { key: 'presentations', label: 'Presentations' },
  { key: 'sold', label: 'Sold' },
] as const;

export type DialKey = (typeof DIALS)[number]['key'];

/**
 * What a rep is told about doors this phone is still holding.
 *
 * WHY THIS EXISTS AT ALL. The dials read the SERVER's counts for today. Until an
 * outbox drains, the phone is holding knocks the server has never seen — so the
 * dial says 6 when the rep knocked 8, and says it with the same confidence it
 * would say a true 6.
 *
 * The macro home's three bubbles used to carry this caveat, and the 10 September
 * update removes them in favour of these dials. Dropping the caveat with them
 * would move the funnel onto the screen a rep now LANDS on and quietly delete the
 * one sentence that made an undercount legible. So it moves here with the numbers.
 *
 * It says "they will send on their own" because that is the part a rep needs: the
 * work is not lost, and there is nothing for them to do about it.
 */
export function pendingNote(pending: number): string | null {
  if (!Number.isFinite(pending) || pending <= 0) return null;
  return pending === 1
    ? '1 door logged on this phone has not reached the server yet, so it is not in these counts. It will send on its own.'
    : `${pending} doors logged on this phone have not reached the server yet, so they are not in these counts. They will send on their own.`;
}

/**
 * Where the rep's daily goal came from, in words.
 *
 * WHY THIS IS ON THE SCREEN AT ALL. The goal used to be typed in by a manager,
 * and a rep could ask them. From 10 September it is derived automatically, and a
 * number that appears from nowhere is indistinguishable from one somebody
 * guessed. The line is short and it is always there.
 *
 * Null when the server did not say — an older deployment, or a frozen row that
 * predates the derivation. Then nothing is shown, rather than a reason invented
 * to fill the space.
 */
export function goalBasisLine(
  basis: 'manager' | 'own-sales' | 'own-activity' | 'starter' | null,
  goal: number,
): string | null {
  const sales = goal === 1 ? '1 sale' : `${goal} sales`;
  switch (basis) {
    case 'manager':
      return `Your manager set this to ${sales} a day.`;
    case 'own-sales':
      return `Set to ${sales} a day from what you have actually been closing.`;
    case 'own-activity':
      return `Set to ${sales} a day from the doors you have been knocking. It follows your own close rate once you have a few sales in.`;
    case 'starter':
      return `Set to ${sales} a day to start. It follows your own numbers once you have knocked a few days.`;
    default:
      return null;
  }
}
