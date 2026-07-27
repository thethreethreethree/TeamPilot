// Selecting the finance period a ledger entry posts to.
//
// The invariant (finance audit H1, 0196): an entry must post to the period that CONTAINS its entry_date, not
// merely "an open period". Client callers historically grabbed `periods[0]` (an arbitrary open period), which
// mis-buckets an entry whose date falls in a different open period — silent now (GL views aggregate by
// entry_date), a hard reject once 0196's containment trigger is live. This helper is the client-side twin of
// that DB check; it is extracted + tested so the fix can't silently regress before 0196 is applied.
//
// Dates are ISO `YYYY-MM-DD` strings; lexicographic comparison equals chronological order for that format, so
// string <= / >= is correct here (no Date parsing, no timezone drift). Boundaries are INCLUSIVE — an entry
// dated exactly on a period's start_date or end_date is inside that period.

export type SelectablePeriod = { id: string; status: string; start_date: string; end_date: string };

/** True iff `dateISO` falls within [period.start_date, period.end_date], inclusive. */
export function periodContainsDate(period: Pick<SelectablePeriod, "start_date" | "end_date">, dateISO: string): boolean {
  return period.start_date <= dateISO && dateISO <= period.end_date;
}

/**
 * The OPEN period that contains `dateISO`, or undefined if none does. Undefined is the honest "no period to
 * post into" state — the caller must block the post rather than fall back to an arbitrary open period. When
 * multiple periods somehow contain the date (a non-overlap trigger should prevent it), the first is returned.
 */
export function findOpenPeriodContaining<T extends SelectablePeriod>(periods: readonly T[], dateISO: string): T | undefined {
  return periods.find((p) => p.status === "open" && periodContainsDate(p, dateISO));
}
