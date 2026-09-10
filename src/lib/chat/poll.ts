/**
 * Deciding whether a poll actually brought anything new.
 *
 * THE BUG THIS REPLACES compared LENGTHS: `prev.length === rows.length ? prev : rows`.
 *
 * Message counts collide. If somebody's message is removed and another arrives
 * between two polls, the count is identical and the new message is DISCARDED —
 * the rep is looking at an open thread and simply never sees it. It is the worst
 * shape of bug for a chat: silent, intermittent, and impossible for the person
 * on the receiving end to distinguish from nobody having replied.
 *
 * Identity beats counting. The last message's id and timestamp, plus the count,
 * answer the real question — is what I am holding still what the server has?
 *
 * IT ALSO SAVES A ROUND TRIP PER POLL. The author names were re-fetched every
 * interval whether or not anybody new had spoken. On a phone in somebody's
 * pocket for a nine-hour shift that is a request every few seconds for an answer
 * that almost never changes.
 */

export type PolledMessage = { id: string; createdAt: string; authorId: string | null };

/** Is the incoming list different from what is already on screen? */
export function hasChanged(prev: PolledMessage[] | null, next: PolledMessage[]): boolean {
  if (prev === null) return true;
  if (prev.length !== next.length) return true;
  if (next.length === 0) return false;
  const a = prev[prev.length - 1];
  const b = next[next.length - 1];
  // The tail identifies the list far more cheaply than comparing every row, and
  // it catches the replace-one-for-one case a count never will.
  return a.id !== b.id || a.createdAt !== b.createdAt;
}

/**
 * Does the name lookup need re-running?
 *
 * Only when an author appears that we have no name for. A message from somebody
 * already on screen needs nothing fetched.
 */
export function needsNames(next: PolledMessage[], known: ReadonlySet<string>): boolean {
  for (const m of next) {
    if (m.authorId && !known.has(m.authorId)) return true;
  }
  return false;
}
