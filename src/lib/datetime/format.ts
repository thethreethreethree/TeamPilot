/**
 * Shared timezone-aware timestamp formatting.
 *
 * WHY this exists (2026-07-29 audit finding): `companies.timezone` was STORED but never
 * CONSUMED — no display anywhere formatted a timestamp with it, so a user in Manila and one
 * in London saw the same server/UTC string. Timestamp rendering was also scattered across a
 * dozen files as ad-hoc `toLocaleString()` / `.slice(0,19)` calls with no single source of
 * truth. This is that source of truth: a pure, testable formatter that honors a timezone.
 *
 * Resolution of the effective timezone is the CALLER's job (user override -> company default
 * -> browser); this module only formats a given instant in a given zone. Keeping it pure means
 * it is unit-testable and reusable from both server and client.
 */

/** How much of the timestamp to show. */
export type TimeStyle = "datetime" | "date" | "time";

const PRESETS: Record<TimeStyle, Intl.DateTimeFormatOptions> = {
  datetime: { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  date: { year: "numeric", month: "short", day: "numeric" },
  time: { hour: "2-digit", minute: "2-digit" },
};

/**
 * Format an instant in a specific IANA timezone.
 *
 * Guarded by construction: an unparseable date returns `""`, and an invalid/undefined
 * timezone falls back to the runtime's local zone rather than throwing — so a bad
 * `companies.timezone` value degrades to a readable local time instead of crashing a page.
 */
export function formatInTimeZone(
  value: string | number | Date | null | undefined,
  timeZone?: string | null,
  style: TimeStyle = "datetime"
): string {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const opts: Intl.DateTimeFormatOptions = { ...PRESETS[style] };
  if (timeZone) opts.timeZone = timeZone;

  try {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  } catch {
    // An invalid IANA zone (e.g. a typo'd companies.timezone) throws a RangeError.
    // Degrade to the same format in the runtime's local zone rather than break the page.
    const { timeZone: _dropped, ...local } = opts;
    void _dropped;
    return new Intl.DateTimeFormat(undefined, local).format(date);
  }
}

/**
 * Resolve the effective timezone from the override chain: per-user -> company -> undefined
 * (which formatInTimeZone treats as the browser's local zone). Pure so the precedence is
 * unit-testable and identical everywhere it is used.
 */
export function resolveTimeZone(
  userTz: string | null | undefined,
  companyTz: string | null | undefined
): string | undefined {
  const clean = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return clean(userTz) ?? clean(companyTz) ?? undefined;
}
