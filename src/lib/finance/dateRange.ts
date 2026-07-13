/**
 * Date-window helpers for the Statements period-over-period comparison (Phase 6). Extracted from the
 * page to fix + lock a timezone bug: `new Date("2026-07-01")` parses a date-only string as UTC
 * midnight, but getFullYear/Month/Date read LOCAL components — so in any negative-UTC-offset timezone
 * (the Americas) the date shifted back a day, throwing the comparison window off by one. These parse
 * ISO parts into a LOCAL date, so the round-trip is timezone-independent (verified by the tests, which
 * pass in any TZ). Pure, no `now`/DOM.
 */

// Today's date as ISO (YYYY-MM-DD) in the user's LOCAL timezone. Use this for default transaction
// dates instead of `new Date().toISOString().slice(0,10)`, which is UTC — for an evening user in a
// negative-offset zone (the Americas) UTC-today is local-TOMORROW, so the default date runs a day
// ahead and, at a month-end evening, misfiles the transaction into the next period.
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Add `days` to an ISO (YYYY-MM-DD) date, returning ISO. Timezone-safe: builds a LOCAL date from the
// parts (not `new Date(str)`, which would parse as UTC and shift the day in negative-offset zones).
export function isoAdd(d: string, days: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  const x = new Date(y ?? 1970, (m ?? 1) - 1, dd ?? 1);
  x.setDate(x.getDate() + days);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

// The same-length window immediately before [from,to] — for period-over-period. Ends the day before
// `from`; same day-count as the current window. Empty inputs → empty (no comparison).
export function priorRange(from: string, to: string): { from: string; to: string } {
  if (!from || !to) return { from: "", to: "" };
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  const pTo = isoAdd(from, -1);
  return { from: isoAdd(pTo, -days), to: pTo };
}
