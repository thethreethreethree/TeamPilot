/**
 * Is this session a sales call? The app's copy of the website's one verdict.
 *
 * WHY (2026-10-12). The website now refuses sales coaching on meetings and huddles: the after-pitch debrief and the
 * read (sales-session/dissect) answer 409 "This is a sales-call feature" for them (TeamPilot d76b48a3, founder
 * choice 2026-10-09). The app lists every session the rep owns, so without this a meeting showed a debrief and a
 * read that could only fail.
 *
 * MIRRORS the website term for term: `isSalesCall` (src/lib/coach/v5/salesOnly.ts) defers to `resolveCoachingMode`,
 * which treats "meeting" and "huddle" as non-sales and everything else, including a missing or unknown kind, as
 * sales. The app cannot import the website's code, so the rule is copied here and pinned by
 * tests/sales-only.test.ts on the same inputs the website's test uses (CLAUDE.md §2.2: a copy needs a drift guard).
 */
export function isSalesCall(sessionKind: string | null | undefined): boolean {
  return sessionKind !== 'meeting' && sessionKind !== 'huddle';
}

/**
 * The kinds that are NOT sales calls, for filtering a list in the query (founder picker 2026-10-23: the session list
 * shows sales calls only; meetings and huddles are reviewed on the web under Meeting Coach). Exactly the kinds
 * isSalesCall refuses; tests/sales-only.test.ts pins the two together.
 */
export const NON_SALES_KINDS = ['meeting', 'huddle'] as const;

/** The PostgREST list for `.not('session_kind', 'in', ...)`. */
export const NON_SALES_KINDS_FILTER = `(${NON_SALES_KINDS.join(',')})`;

/** How the screen names a non-sales session. */
export function sessionKindName(sessionKind: string | null | undefined): string {
  return sessionKind === 'huddle' ? 'huddle' : 'meeting';
}
