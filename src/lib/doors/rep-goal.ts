/**
 * A manager setting one rep's daily sales goal, and what a sale is worth.
 *
 * THE UNIT IS THE WHOLE DANGER HERE, and this app has already paid for it once.
 * `format.ts` records it plainly: "This app has already had one 100x bug from two
 * plan documents describing that column as minor units." The deal-value column is
 * MAJOR units (dollars) and `parseMoney` returns dollars to match it.
 *
 * `rep_daily_sales_goal.sale_value_cents` is the opposite — MINOR units, cents,
 * as its name says. So a manager typing "185" must reach the server as 18500, and
 * getting that backwards would not fail: it would quietly pay every rep in the
 * company one hundredth of what their manager meant, on a screen that looked
 * entirely correct.
 *
 * The conversion therefore happens in ONE named function, with the unit in its
 * name, and a test pins $185 -> 18500 rather than trusting the reading.
 *
 * WHAT THE SERVER WILL AND WILL NOT ACCEPT, read from the route's own schema:
 *   salesGoal      int, POSITIVE  -> zero is rejected, so a goal cannot be
 *                                    cleared by setting it to nothing.
 *   saleValueCents int, >= 0, NULLABLE, optional -> this one CAN be cleared, and
 *                                    clearing it returns the rep's cash box to
 *                                    counting sales rather than showing $0.
 *
 * PURE, so the arithmetic that decides what a rep is told they earned is tested
 * rather than typed into a form handler.
 */

/** What a manager may type, turned into what the server takes. */
export type GoalDraft = {
  /** The daily sales goal, as typed. */
  goalText: string;
  /** What one sale is worth in DOLLARS, as typed. Empty means "not set". */
  perSaleText: string;
};

export type GoalProblem =
  | 'goal-missing'
  | 'goal-not-a-number'
  | 'goal-not-whole'
  | 'goal-not-positive'
  | 'per-sale-not-a-number'
  | null;

/**
 * Dollars to cents, the only place this conversion happens.
 *
 * Rounded, not truncated: "185.555" is a typo either way, and rounding keeps the
 * half-cent from silently shaving money off every sale.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Cents back to dollars, for showing a manager what is already saved. */
export function centsToDollarsText(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents < 0) return '';
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`;
}

/** A goal the way a manager types it: "2", " 3 ". Not money, so no currency. */
export function parseGoal(text: string): number | null {
  const cleaned = (text ?? '').replace(/[\s,]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * What is wrong with the draft, if anything.
 *
 * An EMPTY per-sale is not a problem — it is the ordinary case, and it means the
 * rep's cash box counts sales instead of dollars.
 */
export function goalProblem(draft: GoalDraft, parseDollars: (t: string) => number | null): GoalProblem {
  const goalRaw = (draft.goalText ?? '').trim();
  if (goalRaw === '') return 'goal-missing';
  // A decimal point is allowed THROUGH this check on purpose: "2.5" is a number
  // that is not whole, and saying so is more use to a manager than calling it
  // not a number at all. "two" fails here; "2.5" fails at parseGoal below.
  if (!/^[\d\s,.]+$/.test(goalRaw)) return 'goal-not-a-number';
  const goal = parseGoal(goalRaw);
  if (goal === null) return 'goal-not-whole';
  // The route's schema is `int().positive()`, so zero is refused server-side too.
  if (goal <= 0) return 'goal-not-positive';

  const perSaleRaw = (draft.perSaleText ?? '').trim();
  if (perSaleRaw !== '' && parseDollars(perSaleRaw) === null) return 'per-sale-not-a-number';
  return null;
}

/** The body to PATCH, or null when the draft is not sendable. */
export function goalPatch(
  repId: string,
  draft: GoalDraft,
  parseDollars: (t: string) => number | null,
): { repId: string; salesGoal: number; saleValueCents: number | null } | null {
  if (goalProblem(draft, parseDollars) !== null) return null;
  const goal = parseGoal(draft.goalText);
  if (goal === null) return null;

  const perSaleRaw = (draft.perSaleText ?? '').trim();
  // An empty box CLEARS the value rather than leaving the old one behind: a
  // manager who deletes it means "stop showing dollars", and the column is
  // nullable precisely so that is expressible.
  const saleValueCents =
    perSaleRaw === '' ? null : dollarsToCents(parseDollars(perSaleRaw) as number);

  return { repId, salesGoal: goal, saleValueCents };
}

/** What a manager reads when the draft is not sendable yet. */
export function goalProblemText(problem: GoalProblem): string | null {
  switch (problem) {
    case 'goal-missing':
      return 'Set how many sales a day this rep is aiming for.';
    case 'goal-not-a-number':
    case 'goal-not-whole':
      return 'The daily goal is a whole number of sales, like 2.';
    case 'goal-not-positive':
      return 'The daily goal has to be at least 1 sale.';
    case 'per-sale-not-a-number':
      return 'What a sale is worth should be an amount, like 185.';
    default:
      return null;
  }
}

/** The explanation under the per-sale field, so the blank is understood. */
export const PER_SALE_HINT =
  'Optional. Leave it empty and the rep sees how many sales they have left, not dollars.';
