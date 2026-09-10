/**
 * The five milestone badges, and WHEN each was earned.
 *
 * WHY THE DATE COMES FROM THE SERVER AND IS NOT COMPUTED HERE. Spec §5.3 is
 * explicit, and its reason is structural rather than stylistic: `spark` is the
 * FIRST scored pitch and `century` the HUNDREDTH, and the phone only ever holds
 * a window of the ledger. A rep with four hundred entries would have this file
 * confidently name the wrong day as their first pitch — a wrong date is worse
 * than no date, because it looks exactly like a right one.
 *
 * `deal` and `closer` are worse still: they are the first and tenth SOLD
 * session, and the phone does not read sold sessions here at all.
 *
 * So the route derives all five from the immutable ledger where the full
 * history lives, and this module's job is only to read what it sent — safely,
 * because the payload crosses a network and may be old, partial, or a version
 * of the API that predates a badge.
 *
 * THE UNEARNED CASE IS NOT AN ERROR. `null` means "not yet", which is a real
 * and common state for a new rep. `undefined` — the key absent entirely — means
 * the server did not say, which is different and must not be rendered as "not
 * yet earned": telling a rep who has closed ten deals that they have not is the
 * failure this distinction exists to prevent.
 */

import { MILESTONE_KEYS, type MilestoneKey } from './arena';

/** What the route sends under `milestones`. Every value is an ISO date or null. */
export type MilestoneDates = Partial<Record<MilestoneKey, string | null>>;

/**
 * Three states, deliberately, and the third is the one that matters.
 *
 *   'earned'  — with the day it happened
 *   'not-yet' — the server looked and it has not happened
 *   'unknown' — the server did not say, or said something unreadable
 */
export type MilestoneStatus =
  | { state: 'earned'; at: string }
  | { state: 'not-yet' }
  | { state: 'unknown' };

/** True for a value that can actually be turned into a day. */
function readableDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  return Number.isFinite(Date.parse(value));
}

/**
 * Read the map the route sent.
 *
 * Defensive on purpose: this is a network payload, and an unparseable date is
 * `unknown` rather than a badge that renders "Invalid Date" under it.
 */
export function milestoneStatus(dates: MilestoneDates | null | undefined, key: MilestoneKey): MilestoneStatus {
  if (!dates) return { state: 'unknown' };
  // An absent key reads as `undefined`, which is neither null nor a readable date, so it falls through to
  // 'unknown' below. There WAS a `key in dates` guard here as well; a mutation showed it could be deleted with no
  // test failing, and the reason is that it was equivalent code rather than an untested branch. Removed rather
  // than covered — a guard that cannot change an outcome is a claim about safety that nothing has to honour.
  const value = dates[key];
  if (value === null) return { state: 'not-yet' };
  if (!readableDate(value)) return { state: 'unknown' };
  return { state: 'earned', at: value };
}

/**
 * Pull the map out of a `/my-points` payload without trusting its shape.
 *
 * Returns null when the field is absent, so the caller can tell "an old API
 * that does not send milestones" from "a rep who has earned none" — the same
 * distinction as above, one level up.
 */
export function readMilestoneDates(payload: unknown): MilestoneDates | null {
  const raw = (payload as { milestones?: unknown } | null)?.milestones;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: MilestoneDates = {};
  for (const key of MILESTONE_KEYS) {
    if (!(key in (raw as Record<string, unknown>))) continue;
    const value = (raw as Record<string, unknown>)[key];
    out[key] = readableDate(value) ? value : null;
  }
  return out;
}

/**
 * The line under a badge.
 *
 * `requirement` is what it takes, in the rep's own words, and it is shown for a
 * badge that has NOT been earned — a locked badge whose condition is hidden is
 * just a locked box. `formatDay` is passed in so this module stays pure and the
 * app's one date formatter is not duplicated here.
 */
export function milestoneLine(
  status: MilestoneStatus,
  requirement: string,
  formatDay: (iso: string) => string,
): string {
  if (status.state === 'earned') return formatDay(status.at);
  if (status.state === 'not-yet') return requirement;
  return "Can't check now";
}
