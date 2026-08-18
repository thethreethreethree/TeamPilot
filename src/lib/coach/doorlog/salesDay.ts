/**
 * Sales-day computation for the Door Log (Macro Mode, 2.2 `local_date` / 5.5 rollup boundaries).
 *
 * Policy-agnostic on purpose: this function turns an instant into the LOCAL calendar date in a given
 * timezone. Q5 (what defines a "sales day" — device tz / org tz / cutoff hour) only decides WHICH
 * timezone to feed it; the computation itself is fixed and correct either way, so building it now
 * guesses nothing.
 *
 * It deliberately uses `Intl.DateTimeFormat` with the `timeZone`, NOT `toISOString().slice(0,10)` — the
 * latter yields the UTC date, so an evening knock (e.g. 11:58pm local, west of UTC) would land on the
 * NEXT day's rollup. That UTC-day bug has bitten this codebase before; this avoids the whole class.
 */

/** The local calendar date (YYYY-MM-DD) for `instant` in `timeZone`. */
export function computeLocalSalesDate(instant: Date, timeZone: string): string {
  // en-CA renders as YYYY-MM-DD; the timeZone makes it the LOCAL date, not the UTC date.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The device's IANA timezone (the recommended Q5 default — the rep's own day). Falls back to UTC if
 *  the runtime can't resolve one (never throws). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
