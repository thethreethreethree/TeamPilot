/**
 * The order topics are shown in.
 *
 * BY ACTIVITY, NOT BY AGE. The list arrived ordered by creation date, which puts
 * a topic nobody has touched in months above one that has been busy all week.
 * A rep opening Team Chat is looking for what is happening, not what is oldest.
 *
 * THE FALLBACK IS THE SUBTLE PART. `lastMessageAt` is null in two very different
 * cases: a topic with genuinely nothing said in it, and a topic the rep is not
 * in (the messages policy hides its contents entirely). Both fall back to the
 * creation date, which is the only timestamp that is true for both — and it is
 * honest, because for a topic a rep cannot see into, when it was started is
 * genuinely all this app knows.
 *
 * A CLOSED TOPIC IS NOT PUSHED DOWN. It is still part of the record, and a
 * closed topic with a reply an hour ago is more interesting than an open one
 * from March. Sorting by status would be a second, invented rule on top of the
 * one a rep actually asked for.
 */

export type Orderable = {
  createdAt: string;
  lastMessageAt: string | null;
};

/** The moment a topic last mattered. */
export function activityAt(t: Orderable): string {
  return t.lastMessageAt ?? t.createdAt;
}

/**
 * Newest activity first.
 *
 * Returns a NEW array. Sorting in place would mutate the caller's state, which
 * React will then not see as a change — a reorder that silently does not render.
 */
export function byActivity<T extends Orderable>(topics: T[]): T[] {
  return [...topics].sort((a, b) => {
    const at = activityAt(a);
    const bt = activityAt(b);
    if (at === bt) return 0;
    // ISO-8601 timestamps compare correctly as strings, and doing it this way
    // avoids constructing two Date objects per comparison on a list that
    // re-renders on every poll.
    return at > bt ? -1 : 1;
  });
}
