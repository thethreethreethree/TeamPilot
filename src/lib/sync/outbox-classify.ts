/**
 * What a failed write MEANS — and therefore whether it is worth trying again.
 *
 * This is the whole judgement of the outbox, and it lives on its own, importing
 * nothing. Two reasons, and the second is the one that mattered:
 *
 *   - it is the piece most worth testing, and it can be tested exhaustively
 *     without a network, an auth SDK or a filesystem;
 *   - keeping it beside the HTTP client made it untestable in this project's
 *     test runner, which strips types rather than compiling them and cannot load
 *     the client's parameter-property constructor. A pure rule that can only be
 *     exercised through a network stack is a rule that will not be exercised.
 *
 * THE CLASSIFICATION, AND WHY EACH ONE.
 *
 *   401 / 403 → needs-shim. Both can mean NOTHING the app sends will be taken:
 *     a token the route refuses even after a refresh, or a profile with no
 *     company context. Neither changes by retrying, so the whole sweep stops
 *     rather than burning every entry's attempts on the same wall.
 *
 *   404 → rejected, and this CHANGED on 4 September. It used to halt the sweep
 *     with 401 and 403, which was right while every coach route was cookie-only:
 *     a 404 then meant an RLS-scoped read seeing nothing because the app was not
 *     authenticated at all, so the next entry would hit the same wall.
 *
 *     The routes take a Bearer token now — verified against production — so a
 *     404 means what it says: THAT session or pitch is not there. Deleted on the
 *     website, or belonging to someone else. It says nothing whatever about the
 *     next entry, and halting on it was actively harmful: one stale entry
 *     pointing at a deleted call stopped EVERY other queued write until the app
 *     was restarted, and told the rep the server would not accept the app.
 *
 *     So it is now permanent for its own entry and permanent for nothing else.
 *
 *   409 → conflict. Someone changed this call somewhere else. The queue keeps
 *     the entry and surfaces it, because the rep is the only one who can say
 *     whether their instruction still stands. Silently winning and silently
 *     losing are both wrong.
 *
 *   400 / 422 and other 4xx → rejected. The server understood and refused: a
 *     deal value out of range, a name too long. Retrying sends the identical
 *     body to the identical rule, so it stays queued with the server's own
 *     message attached and the rep decides.
 *
 *   429 / 5xx / no response → transient. The request never got a verdict. This
 *     is the ordinary offline case and the ordinary server-hiccup case, and the
 *     only one that earns another automatic try.
 *
 * WHY THE SERVER'S OWN MESSAGE IS CARRIED. "Deal value must be at most
 * 100000000" tells a rep what to change. "Could not save that" tells them to try
 * the same thing again. Whichever the server actually sent is what gets shown.
 */

/** The result of one attempt, in the vocabulary the sweep decides on. */
export type SendOutcome =
  | { ok: true }
  | { ok: false; reason: 'needs-shim' | 'rejected' | 'conflict' | 'transient'; message?: string };

/**
 * Statuses that mean NOTHING the app sends will be accepted, so the sweep should
 * stop rather than spend every entry's attempts discovering the same thing.
 *
 * 404 is deliberately NOT here — see the note above. It is about one row, not
 * about the app.
 */
function isNotSwitchedOn(status: number): boolean {
  return status === 401 || status === 403;
}

export function classify(status: number | undefined, message?: string): SendOutcome {
  // No status at all means the request never reached a verdict — a dead
  // connection, a DNS failure, a dropped socket. Always worth another try.
  if (status === undefined) return { ok: false, reason: 'transient', message };
  if (isNotSwitchedOn(status)) return { ok: false, reason: 'needs-shim', message };
  if (status === 409) return { ok: false, reason: 'conflict', message };
  if (status === 429 || status >= 500) return { ok: false, reason: 'transient', message };
  if (status >= 400) return { ok: false, reason: 'rejected', message };
  // A non-error status reaching here means the caller threw on something that
  // was not a failure. Treat it as transient rather than discarding the write.
  return { ok: false, reason: 'transient', message };
}
