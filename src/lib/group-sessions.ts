/**
 * Grouping the rep's sessions by day, on the device.
 *
 * 03-DATA-MODEL-AND-SYNC.md names this as work the app should do locally:
 * "compute locally: pure presentation — grouping a rep's own already-fetched
 * sessions by day". Nothing here derives a decision the server owns; it only
 * arranges rows the rep already has.
 *
 * It lives in its own module so it can be exercised directly. A pure function
 * behind a screen is a pure function nobody tests.
 */
import type { CoachingSession } from '@/types/backend';
import { outcomeLabel, shortDate } from '@/lib/format';

/**
 * GENERIC OVER THE ROW, because this module is about grouping and nothing else.
 *
 * The list now carries a per-row segment count alongside the session, so its
 * rows are wider than `CoachingSession`. Widening this type to match would drag
 * the sessions list's query shape into a pure date-grouping module; a type
 * parameter keeps the caller's row intact through the grouping without this
 * file knowing or caring what else is on it.
 */
export type SessionSection<T extends CoachingSession = CoachingSession> = {
  title: string;
  data: T[];
};

/**
 * Local calendar day, not UTC. A rep's "Tuesday" is the Tuesday they were
 * standing on a doorstep, not the one the server happened to record.
 */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Group by calendar day, newest day first, labelling the two most recent days in
 * the words a rep would use. Rows arrive newest-first from the query, so order
 * within a day is already correct and is deliberately not re-sorted.
 *
 * The filter runs in the same pass, matching the client label and the outcome —
 * the two things a rep actually remembers about a call.
 *
 * @param now injectable so the Today/Yesterday boundary can be exercised at a
 *            fixed instant rather than only at whatever time the suite runs.
 */
export function groupByDay<T extends CoachingSession>(
  rows: T[],
  query = '',
  now: Date = new Date(),
  /**
   * Rep id → name, for a MANAGER's list. Optional: a rep viewing their own calls has no owner
   * names on screen, so there is nothing extra to search and nothing changes for them.
   */
  names?: ReadonlyMap<string, string>,
): SessionSection<T>[] {
  const q = query.trim().toLowerCase();

  /**
   * What a search looks at.
   *
   * Everything the rep can SEE about a session on this screen or the next, and
   * nothing they cannot. Territory, approach and offer are here because the app
   * now asks for them when a recording is sent, and a rep who typed "Northside"
   * into a call reasonably expects to find it by typing "Northside" again —
   * searching only the label made their own answers unfindable.
   *
   * The transcript is deliberately NOT searched: it is not loaded with the list,
   * so a match would depend on which sessions happened to be open. A search that
   * finds a call sometimes is worse than one that never claims to.
   */
  const match = (s: CoachingSession) =>
    !q ||
    [
      s.client_label,
      outcomeLabel(s.outcome),
      s.territory,
      s.approach,
      s.offer,
      /*
        THE REP'S NAME, when there is one on screen (2026-09-11).
        
        This rule already existed above and this field was missing from it. A manager's list shows
        whose call each row is - the name is right there under the title - and typing it found
        nothing. So the one search a manager most obviously reaches for, after reading "Moses: to
        coach on X" on the team screen, was the one that did not work.
        
        Passed in rather than looked up, because the id→name map already lives on the screen and a
        second source would be a second answer to "who is this".
      */
      names?.get(s.agent_id ?? '') ?? null,
    ].some((field) => (field ?? '').toLowerCase().includes(q));

  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString());

  const order: string[] = [];
  const buckets = new Map<string, T[]>();

  for (const row of rows) {
    if (!match(row)) continue;
    const key = dayKey(row.started_at);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(row);
  }

  return order.map((key) => ({
    title:
      key === today
        ? 'Today'
        : key === yesterday
          ? 'Yesterday'
          : key === 'unknown'
            ? 'Undated'
            : labelForDayKey(key),
    data: buckets.get(key)!,
  }));
}

/**
 * Render a day key as a date the rep recognises.
 *
 * The key is a LOCAL calendar day, so it must be rebuilt as a local date. An
 * earlier version appended "T00:00:00Z" and parsed the key as UTC: harmless east
 * of Greenwich, but at UTC-5 the label for 28 August rendered as "Thu 27 Aug" —
 * every older group showing the wrong day for every rep in the Americas. The
 * machine this was written on is UTC+8, which is exactly why it would not have
 * surfaced here.
 */
function labelForDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return 'Undated';
  return shortDate(new Date(y, m - 1, d).toISOString());
}
