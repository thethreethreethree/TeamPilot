/**
 * The day's door target, worked back from a manager-set sales goal.
 *
 * The chain, read right to left — the goal is known and the doors fall out last:
 *
 *     goal  ->  presentations (÷ close ratio)  ->  doors (÷ contact ratio)
 *
 * PORTED, NOT REINVENTED. This is the arithmetic in the web's
 * `src/lib/coach/doorlog/dayTarget.ts`, copied term for term including the two
 * things that look like details and are not: it rounds UP at EVERY step, and it
 * clamps the door number to [20, 200] AFTER rounding. Round down anywhere and the
 * rep is handed a target that cannot reach the goal; the spec's worked example is
 * the check — goal 2, close 1/9, contact 1/4.4 must give 18 presentations and
 * **80** doors, not 79.
 *
 * A second implementation of somebody else's arithmetic is a disagreement waiting
 * for a value that lands between the two, so the tests pin the worked example
 * rather than trusting that the code reads the same.
 *
 * NO FABRICATED TARGET. A goal of zero — the manager has not set one — returns
 * all-zero targets so the screen can show its no-goal state. It does not invent a
 * number to fill the dials with.
 */

/** Starter ratios, used until a rep has enough history to trust their own. */
export const STARTER_CLOSE_RATIO = 1 / 9;
export const STARTER_CONTACT_RATIO = 1 / 4.4;

/** A door number outside these is useless either way. */
export const DOORS_FLOOR = 20;
export const DOORS_CEILING = 200;

export type DayTargetInput = {
  salesGoal: number;
  /** sales ÷ presentations over 30 days, or null without enough history. */
  closeRatio: number | null;
  /** presentations ÷ doors over 30 days, or null without enough history. */
  contactRatio: number | null;
  /** True once the rep's OWN ratios can be trusted (>=10 presentations and >=1 sale). */
  qualified: boolean;
};

export type DayTarget = {
  doorsTarget: number;
  presentationsTarget: number;
  soldTarget: number;
  usedStarter: boolean;
};

const ceilPos = (n: number) => Math.max(0, Math.ceil(n));
const usable = (r: number | null): r is number =>
  typeof r === 'number' && Number.isFinite(r) && r > 0;

export function calculateDayTarget(input: DayTargetInput): DayTarget {
  const soldTarget = ceilPos(input.salesGoal);
  if (soldTarget <= 0) {
    return { doorsTarget: 0, presentationsTarget: 0, soldTarget: 0, usedStarter: true };
  }

  const ownRatios = input.qualified && usable(input.closeRatio) && usable(input.contactRatio);
  const close = ownRatios ? (input.closeRatio as number) : STARTER_CLOSE_RATIO;
  const contact = ownRatios ? (input.contactRatio as number) : STARTER_CONTACT_RATIO;

  const presentationsTarget = ceilPos(soldTarget / close);
  const rawDoors = ceilPos(presentationsTarget / contact);
  const doorsTarget = Math.min(DOORS_CEILING, Math.max(DOORS_FLOOR, rawDoors));

  return { doorsTarget, presentationsTarget, soldTarget, usedStarter: !ownRatios };
}

/**
 * How full a dial is: the fraction of target reached, CLAMPED at one.
 *
 * Overshoot fills the ring and stops — 95 of 80 is a full ring, not a second lap.
 * No target yields an empty ring rather than a full one.
 */
export function dialFill(count: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.min(1, Math.max(0, count / target));
}

// ---------------------------------------------------------------------------
// The cash box (added 2026-09-10, reversing the earlier "no cash")
// ---------------------------------------------------------------------------

/**
 * What the bottom box shows.
 *
 * THE $-PER-SALE IS OPTIONAL, and that is the whole design of this type. A
 * manager may never set one, and when they have not the box must fall back to
 * counting sales — never to `$0`, which would tell a rep who sold two houses
 * that they earned nothing.
 */
export type CashBox =
  /** A manager has set a value per sale, so the box can talk in money. */
  | { kind: 'money'; earnedCents: number; perSaleCents: number; toGoalCents: number; goalMet: boolean }
  /** No value per sale. Count the sales instead. */
  | { kind: 'sales'; remaining: number; goalMet: boolean };

/**
 * Earned today, and what is left to the goal.
 *
 * `earned = sold x perSale`, `toGoal = max(0, soldTarget - sold) x perSale`, both
 * in CENTS because that is what the column stores and because money rounded
 * through a float is money that disagrees with itself.
 */
export function cashBox(
  soldToday: number,
  soldTarget: number,
  saleValueCents: number | null | undefined,
): CashBox {
  const sold = Number.isFinite(soldToday) ? Math.max(0, Math.trunc(soldToday)) : 0;
  const target = Number.isFinite(soldTarget) ? Math.max(0, Math.trunc(soldTarget)) : 0;
  const remaining = Math.max(0, target - sold);
  // A target of zero means no goal is set, so "goal met" would be a claim about
  // a goal nobody made. Only a real target can be met.
  const goalMet = target > 0 && remaining === 0;

  const perSale =
    typeof saleValueCents === 'number' && Number.isFinite(saleValueCents) && saleValueCents > 0
      ? Math.trunc(saleValueCents)
      : null;

  if (perSale === null) return { kind: 'sales', remaining, goalMet };
  return {
    kind: 'money',
    earnedCents: sold * perSale,
    perSaleCents: perSale,
    toGoalCents: remaining * perSale,
    goalMet,
  };
}

/**
 * Cents as money a rep reads.
 *
 * Whole dollars when the cents are zero, because "$185" is what a manager said
 * and "$185.00" is a spreadsheet talking.
 */
export function money(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.trunc(cents)) : 0;
  const dollars = Math.trunc(safe / 100);
  const rest = safe % 100;
  const whole = dollars.toLocaleString('en-US');
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, '0')}`;
}

/** The sales-to-goal line, when there is no money to talk in. */
export function salesToGoalText(remaining: number, goalMet: boolean): string {
  if (goalMet) return 'Goal met';
  if (remaining <= 0) return 'No goal set yet';
  return `${remaining} more ${remaining === 1 ? 'sale' : 'sales'} to goal`;
}

/**
 * The target sentence, in the founder's words from the mockup.
 *
 * A ratio is shown as "1 sale per N presentations", not as 0.111 — the rep is
 * being told how their day works, and a decimal is not how anyone says it.
 */
export function targetSentence(
  closeRatio: number | null,
  contactRatio: number | null,
  soldTarget: number,
  doorsTarget: number,
  usedStarter: boolean,
): string {
  const close = usedStarter || !closeRatio ? STARTER_CLOSE_RATIO : closeRatio;
  const contact = usedStarter || !contactRatio ? STARTER_CONTACT_RATIO : contactRatio;
  const perSale = round1(1 / close);
  const perPresentation = round1(1 / contact);
  return (
    `Your close ratio is 1 sale per ${perSale} presentations and ` +
    `1 presentation per ${perPresentation} doors. ` +
    `To land ${soldTarget} ${soldTarget === 1 ? 'sale' : 'sales'} today, knock ${doorsTarget} doors.`
  );
}

/** One decimal, and no trailing ".0" — the mockup says 9 and 4.4, not 9.0. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
