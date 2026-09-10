/**
 * "Open my last pitch" — where the door log's shortcut should send a rep.
 *
 * WORKS WITHOUT THE BACKEND BRANCH. The web reaches this through a server
 * redirect, but that redirect only reads `pitches` with `rep_id = auth.uid()`
 * under RLS. The phone can ask the same question directly, so this shortcut is
 * live today even while the coach routes wait to be merged.
 *
 * IT NEVER DEAD-ENDS, which is the whole design of the web's version too: a read
 * error and "no pitch yet" both fall back to the Pitch Performance list, because
 * the list has its own honest empty and error states. Landing a rep on a broken
 * detail screen — or on nothing at all — at the end of a day of knocking is the
 * one outcome worth engineering against.
 *
 * The two cases are still DISTINGUISHED for the caller, because "you have not
 * recorded a pitch yet" and "we could not check" are different things to say if
 * anyone ever wants to say them. Today both route to the same place.
 */

export type LatestPitchTarget =
  | { kind: 'pitch'; pitchId: string }
  | { kind: 'list'; because: 'none-yet' | 'unreadable' };

/** What a lookup result means. Pure, so the routing decision is testable. */
export function latestPitchTarget(result: {
  pitchId?: string | null;
  failed?: boolean;
}): LatestPitchTarget {
  if (result.failed) return { kind: 'list', because: 'unreadable' };
  const id = typeof result.pitchId === 'string' ? result.pitchId.trim() : '';
  if (!id) return { kind: 'list', because: 'none-yet' };
  return { kind: 'pitch', pitchId: id };
}
