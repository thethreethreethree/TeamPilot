/**
 * Display helpers — the EDGE of the app. Stored values become human text here
 * and only here.
 */
import type { SessionOutcome } from '@/types/backend';

/**
 * deal_value is `numeric(14, 2)` on the server — an EXACT DECIMAL in MAJOR units
 * (1500.00 means $1,500.00), verified against supabase/migrations/0205, whose own
 * comment reads "deal_value is numeric (exact-decimal — money is never float)".
 *
 * Two of the build-plan documents describe it as "integer minor units"; they are
 * wrong, and treating it that way renders $1,500.00 as $15.00 — a 100x error on
 * money. The type is the authority here, not the prose.
 *
 * PostgREST serialises `numeric` as a STRING to preserve precision, so the value
 * arrives as "1500.00" far more often than as a number. This formats from the
 * string by splitting on the decimal point — no float arithmetic touches the
 * amount at any point, which is what the money rule actually protects.
 */
export function money(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const raw = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (raw === '') return null;

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) return null;

  const [wholeRaw, fracRaw = ''] = unsigned.split('.');
  // Round to 2dp using string digits, so a value like "1500.005" cannot be
  // nudged by binary floating point on its way to the screen.
  const frac2 = (fracRaw + '00').slice(0, 2);
  const whole = Number(wholeRaw).toLocaleString('en-US');
  const body = frac2 === '00' ? whole : `${whole}.${frac2}`;

  return `${negative ? '-' : ''}$${body}`;
}

/**
 * A whole number with thousands separators — "1,240".
 *
 * THE LOCALE IS PINNED, deliberately. A bare `toLocaleString()` follows the
 * DEVICE's locale, so the same rep's total renders "1,240" beside a money value
 * and "1.240" in the Arena on a Spanish or German phone — two formats for two
 * numbers on one screen, from one app that never offered a language choice.
 * Every other formatted number here pins its locale for the same reason.
 *
 * Not for money — `money()` owns that, including the currency symbol and the
 * string-digit rounding.
 */
export function count(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

/** "Fri 12 Sep" — never "12/09", which is two different dates depending on the reader. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * audio_duration_seconds is the trustworthy length (migration 0210).
 *
 * Hours are carried explicitly: session_kind can be 'meeting' or 'huddle', not
 * only 'sales', and a meeting that ran an hour and a minute reading as "61m 1s"
 * is the kind of small wrongness that makes a screen feel unconsidered.
 */
export function duration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Outcome labels are deliberately FACTUAL, never evaluative. Asset A11: the
 * system surfaces what happened and the rep renders the verdict — "No sale" is a
 * fact; "Missed" or "Failed" would be a judgement the app is not entitled to make.
 */
export const OUTCOME_LABEL: Record<SessionOutcome, string> = {
  sold: 'Sold',
  follow_up: 'Follow-up',
  no_sale: 'No sale',
  no_contact: 'No contact',
  undecided: 'Undecided',
};

/** The server's own order, from SALES_OUTCOMES in TeamPilot's salesCoach.ts. */
export const OUTCOMES: SessionOutcome[] = [
  'sold',
  'follow_up',
  'no_sale',
  'no_contact',
  'undecided',
];

export function outcomeLabel(outcome: SessionOutcome | null): string {
  return outcome ? OUTCOME_LABEL[outcome] : 'Not recorded';
}

/**
 * Read a deal value the way a rep types it.
 *
 * They write "1500", "1,500", "$1,500" or "$1500.00", and the server takes a
 * number in MAJOR units — the column is numeric(14,2), so 1500 means $1,500.00.
 * This app has already had one 100x bug from two plan documents describing that
 * column as minor units, which is why the unit is stated here rather than
 * assumed by the caller.
 *
 * Anything that is not a plain non-negative amount returns null: absent, rather
 * than a guess. A misread deal value does not fail loudly — it quietly changes
 * the rep's revenue and average deal size, and nobody would know where it came
 * from.
 */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  // A bare, optionally-decimal number. Rejects "1.2.3", "12e5", "-5" and "abc".
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * The day under a milestone badge — "12 Aug".
 *
 * NO WEEKDAY, unlike `shortDate`. "Wed 12 Aug" under a hexagon is three words
 * where one date is wanted, and the weekday of a milestone earned four months
 * ago tells a rep nothing.
 *
 * DAY BEFORE MONTH, and pinned to `en-GB` for the same reason `shortDate` is:
 * every other date in this app reads that way, and a badge that alone said
 * "Aug 12" would be the one place the convention flipped. The replication spec
 * writes its example as "Aug 12", which is the WEB's locale — it is showing
 * that a date belongs there, not legislating the order. The locale is pinned
 * rather than left to the device, so the app does not quietly render one order
 * on a rep's phone and another on their colleague's.
 */
export function badgeDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
