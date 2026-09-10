/**
 * Finding one pitch among two hundred.
 *
 * The list is capped server-side at 200 and does not paginate, so a rep three
 * weeks into door-knocking is scrolling a wall of addresses. Sessions already
 * has a search; Pitch Performance had none.
 *
 * IT SEARCHES ONLY WHAT IS ON THE SCREEN, the same rule the session search
 * follows and for the same reason: the name, the outcome, and the summary line
 * are what a rep can see, so those are what they can search. The transcript is
 * NOT searched — it is not loaded with the list, so a match would depend on
 * which pitches happened to have been opened, and a search whose results depend
 * on invisible state is worse than no search. A rep would try a word they
 * remember saying, get nothing, and conclude the pitch was gone.
 *
 * THE OUTCOME IS MATCHED BY ITS LABEL, not its database value. A rep types
 * "go back", not "go_back", and matching only the raw value would make the most
 * obvious search anybody tries return nothing.
 */

export type SearchablePitch = {
  name: string;
  outcome: string;
  summary: string | null;
};

/** Below this many pitches a search field is furniture, not help. */
export const SEARCH_THRESHOLD = 8;

/**
 * @param outcomeLabel the same map the list renders with, passed in so the two
 *   can never disagree about what "go_back" is called.
 */
export function matchesPitch(
  pitch: SearchablePitch,
  query: string,
  outcomeLabel: (outcome: string) => string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    pitch.name,
    pitch.outcome,
    outcomeLabel(pitch.outcome),
    pitch.summary ?? '',
  ]
    .join(' ')
    .toLowerCase();
  // Every word must appear somewhere, so "oak sold" narrows rather than widens.
  // Matching ANY word would make a second word make the results worse, which is
  // the opposite of what typing more is for.
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export function filterPitches<T extends SearchablePitch>(
  pitches: T[],
  query: string,
  outcomeLabel: (outcome: string) => string,
): T[] {
  if (!query.trim()) return pitches;
  return pitches.filter((p) => matchesPitch(p, query, outcomeLabel));
}
