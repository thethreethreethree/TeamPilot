import {
  STARTER_CLOSE_RATIO,
  STARTER_CONTACT_RATIO,
} from "./dayTarget";

/**
 * The daily sales goal, worked out from the rep's own record rather than typed
 * in by anyone (founder, 2026-09-10: "I want the daily goal to be automatically
 * decided by OUR AI system based on the system logic of the build feature").
 *
 * WHY THIS COULD NOT SIMPLY BE "WHAT THEY USUALLY SELL". Measured against
 * production on 10 September 2026: the company holds 613 door knocks and 83
 * recorded pitches, and ZERO sessions with an outcome recorded — no sales
 * history exists at all. A goal derived from past sales would be 0 for every rep
 * in the business, which is not a goal, it is a shrug. And
 * `companies.sales_coach_monthly_deal_target` is null, so there is no company
 * quota to divide either. Both of the obvious sources are empty.
 *
 * WHAT IS NOT EMPTY is what a rep actually DOES. So the goal is derived from
 * activity and only upgrades to outcomes once outcomes exist:
 *
 *   own-sales     the rep has real sales in the window. The goal is the rate
 *                 they already achieve, rounded up - "keep this up", not a
 *                 number invented above them.
 *   own-activity  no sales yet, but they knock. Their doors-per-working-day is
 *                 run FORWARD through the starter ratios to the sales those
 *                 doors imply. A rep knocking 80 doors a day is being told the
 *                 2 sales their own effort already predicts.
 *   starter       no activity at all. The doc's worked example, so a brand new
 *                 rep opens the app to a real screen instead of an empty one.
 *
 * THE BASIS TRAVELS WITH THE NUMBER. A rep is owed the reason a target is what
 * it is - a figure with no visible derivation is indistinguishable from one
 * somebody guessed, and this app's whole argument is that it does not guess.
 *
 * ROUNDED UP, NEVER DOWN, AND NEVER BELOW ONE. Rounding 1.4 down to 1 quietly
 * lowers a rep's day; a goal of 0 is not a goal. Ceiling with a floor of 1 is
 * the only shape that is always a real target.
 *
 * PURE, so the arithmetic that sets every rep's day is tested rather than
 * trusted to a read of the code.
 */

/** Where a derived goal came from. Shown to the rep, not just logged. */
export type GoalBasis = "own-sales" | "own-activity" | "starter";

export type DerivedGoal = { goal: number; basis: GoalBasis };

/**
 * The goal a brand-new rep gets, matching doc 06's worked example (goal 2 ->
 * 18 presentations -> 80 doors). It is a starting assumption and says so.
 */
export const STARTER_DAILY_SALES_GOAL = 2;

/** Nobody is asked for more than this by the machine. A human may still set more. */
export const DERIVED_GOAL_CEILING = 10;

const ceilAtLeastOne = (n: number): number =>
  !Number.isFinite(n) || n <= 0 ? 1 : Math.min(DERIVED_GOAL_CEILING, Math.max(1, Math.ceil(n)));

export function deriveDailySalesGoal(input: {
  /** Sales in the window. */
  sold: number;
  /** Recorded pitches in the window. */
  presentations: number;
  /** Doors knocked in the window. */
  doors: number;
  /** Distinct days the rep actually logged a door. Never the window length. */
  activeDays: number;
}): DerivedGoal {
  const sold = Math.max(0, Math.trunc(input.sold ?? 0));
  const doors = Math.max(0, Math.trunc(input.doors ?? 0));
  // DISTINCT WORKING DAYS, not the 30-day window. A rep who worked five days
  // divided by thirty would be handed a goal a sixth of what they can do, and
  // would meet it by lunchtime on day one.
  const activeDays = Math.max(0, Math.trunc(input.activeDays ?? 0));

  if (sold > 0 && activeDays > 0) {
    return { goal: ceilAtLeastOne(sold / activeDays), basis: "own-sales" };
  }

  if (doors > 0 && activeDays > 0) {
    // Their own doors, through the starter funnel, to the sales those doors
    // imply. 80 doors a day at 1-in-4.4 and 1-in-9 is 2 sales - the same
    // arithmetic the target card already shows them, run in reverse.
    const impliedSales = (doors / activeDays) * STARTER_CONTACT_RATIO * STARTER_CLOSE_RATIO;
    return { goal: ceilAtLeastOne(impliedSales), basis: "own-activity" };
  }

  return { goal: STARTER_DAILY_SALES_GOAL, basis: "starter" };
}

/** What the rep reads under the target, so the number is never unexplained. */
export function goalBasisSentence(basis: GoalBasis, goal: number): string {
  const sales = goal === 1 ? "1 sale" : `${goal} sales`;
  switch (basis) {
    case "own-sales":
      return `Set to ${sales} a day from what you have actually been closing.`;
    case "own-activity":
      return `Set to ${sales} a day from the doors you have been knocking. It will follow your own close rate once you have a few sales in.`;
    default:
      return `Set to ${sales} a day to start. It will follow your own numbers once you have knocked a few days.`;
  }
}
