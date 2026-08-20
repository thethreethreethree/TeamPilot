/**
 * Deterministic header-date resolution for schedule imports (§0 — the real files, HK.pdf / HUB SCHED.pdf, drove
 * this). Real staff×date schedules put the DAY numbers in the header row (16, 17, …, 31) and the MONTH somewhere
 * nearby (a "AUGUST" title cell, or "AUG." repeated across the columns), but almost never the YEAR. The LLM
 * propose step, given only bare day numbers and no year, correctly refuses to invent dates — so the preview
 * couldn't build. This resolves those dates WITHOUT the LLM: month from the file (or today), year chosen so the
 * schedule lands nearest today. Pure + unit-tested; feeds the same manager-confirmed preview (never auto-imports).
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/** The first month name found anywhere in `text` (word-wise, tolerant of "AUG." / "August"), or null. */
export function findMonth(text: string): number | null {
  const words = text.toLowerCase().match(/[a-z]{3,9}/g);
  if (!words) return null;
  for (const w of words) {
    const mo = MONTHS[w] ?? MONTHS[w.slice(0, 3)];
    if (mo) return mo;
  }
  return null;
}

interface TodayParts { year: number; month: number; day: number; }
function partsOf(iso: string): TodayParts {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y || 2000, month: m || 1, day: d || 1 };
}

/** Pick the year that places `month` nearest today — schedules are near-term, so this year unless that lands the
 *  date far (>6 months) in the past/future, in which case roll to the adjacent year (Dec seen in Jan → last year;
 *  Jan seen in Dec → next year). */
function pickYear(month: number, t: TodayParts): number {
  const monthsFrom = (y: number) => (y - t.year) * 12 + (month - t.month);
  if (monthsFrom(t.year) < -6) return t.year + 1;
  if (monthsFrom(t.year) > 6) return t.year - 1;
  return t.year;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Resolve each header label to an ISO date, or "" when it isn't a date column (e.g. "TOTAL"). Handles:
 *   - "AUG 16" / "AUGUST 16" / "AUG. 16"  → month from the label, year from today
 *   - bare "16"                            → month from `monthHint` (found elsewhere in the file), year from today
 * Returns [] mapped to "" where unresolvable. `monthHint` is 1–12 or null; `todayIso` is YYYY-MM-DD.
 */
export function resolveHeaderDates(headerCells: string[], monthHint: number | null, todayIso: string): string[] {
  const t = partsOf(todayIso);
  return headerCells.map((h) => {
    const s = h.trim();
    // Month-name + day, e.g. "AUG 16", "AUGUST 16", "AUG. 16".
    const md = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})$/.exec(s);
    if (md) {
      const mo = MONTHS[md[1]!.toLowerCase()] ?? MONTHS[md[1]!.slice(0, 3).toLowerCase()];
      const day = Number(md[2]);
      if (mo && day >= 1 && day <= 31) return iso(pickYear(mo, t), mo, day);
    }
    // Bare day number — needs a month from elsewhere in the file.
    if (/^\d{1,2}$/.test(s) && monthHint) {
      const day = Number(s);
      if (day >= 1 && day <= 31) return iso(pickYear(monthHint, t), monthHint, day);
    }
    return "";
  });
}

/**
 * Best-effort resolution for a whole extracted grid: find the month from the header row text (a title cell like
 * "AUGUST", or "AUG." columns), then resolve the day/month labels. Returns the ISO dates (some may be "") plus
 * whether ANY resolved — the caller pre-fills the confirm step only when at least one did.
 */
export function resolveGridDates(headerCells: string[], headerRowText: string, todayIso: string): { dates: string[]; anyResolved: boolean } {
  const monthHint = findMonth(headerRowText) ?? findMonth(headerCells.join(" "));
  const dates = resolveHeaderDates(headerCells, monthHint, todayIso);
  return { dates, anyResolved: dates.some((d) => d) };
}
