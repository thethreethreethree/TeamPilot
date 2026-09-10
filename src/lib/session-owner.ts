/**
 * Whose call is this, when the list is showing you more than your own.
 *
 * THE PROBLEM THIS FIXES, found on 10 September. The Sessions screen is written
 * as "the rep's own coaching sessions" and shows one name per row: the CUSTOMER's.
 * That was true when it was written. It is not true for a manager — the SELECT
 * policy on `coaching_sessions` grants a same-company manager the whole team's
 * calls, and the app has no `agent_id` filter, so it renders them all. Measured
 * against production: this account sees 196 sessions belonging to 3 different
 * reps, every row labelled only by the customer.
 *
 * So a manager could already open any rep's call and read the full transcript —
 * the capability the spec asked for was already there — and had no way to tell
 * whose call they had opened. A feature nobody can aim is not a feature.
 *
 * WHY THIS DOES NOT ASK "IS THE VIEWER A MANAGER". That question already has two
 * different answers in this system: the app's `COMPANY_SCOPE_ROLES` is
 * `CEO/CFO/COO/admin`, while the RLS predicate is `CEO/COO/admin OR
 * sales_coach_role = 'admin'`. A rep who is a sales-coach admin but a plain
 * member is granted the team by RLS and would be judged "self" by the app — they
 * would see other reps' calls with no names on them, which is the exact confusion
 * this exists to remove. Copying the predicate into a third place would make that
 * drift permanent.
 *
 * Instead it consumes the verdict RLS already gave: a row whose `agent_id` is not
 * yours is somebody else's, whatever role either of you holds. That is the
 * "consume the verdict, don't re-derive" rule this module's neighbour already
 * states, applied to access instead of arithmetic.
 *
 * A REP SEES NO NAMES AT ALL, and that is deliberate. Every row would carry the
 * same name, and a label repeated on every row of a list is weight without
 * signal — the lesson this screen already learned from an outcome chip that read
 * "Not recorded" on 49 consecutive rows.
 *
 * PURE, so what a manager reads is a tested rule rather than a ternary in a row.
 */

/** Whether this row belongs to somebody other than the person reading it. */
export function isSomeoneElses(
  sessionAgentId: string | null | undefined,
  viewerId: string | null | undefined,
): boolean {
  const owner = (sessionAgentId ?? '').trim();
  const me = (viewerId ?? '').trim();
  // Unknown on either side means DO NOT LABEL. Naming a row "someone else's"
  // because the viewer's id had not loaded yet would put a stranger's name on a
  // rep's own call for the first frame after launch.
  if (!owner || !me) return false;
  return owner !== me;
}

/**
 * What to show for the owner of a row, or null to show nothing.
 *
 * NULL FOR YOUR OWN ROWS, and null when the name has not arrived. A row that
 * says "Unknown rep" is worse than a row that says nothing: it reads as data the
 * app holds and got wrong, rather than a lookup that has not finished.
 */
export function ownerLabel(
  sessionAgentId: string | null | undefined,
  viewerId: string | null | undefined,
  names: ReadonlyMap<string, string>,
): string | null {
  if (!isSomeoneElses(sessionAgentId, viewerId)) return null;
  const name = names.get((sessionAgentId ?? '').trim())?.trim();
  return name && name.length > 0 ? name : null;
}

/**
 * The same fact for a screen reader, said as a phrase.
 *
 * Spoken as "recorded by Johns Ramos" rather than the bare name, because the row
 * is read as one continuous sentence and a name dropped between a customer and a
 * time reads as a second customer.
 */
export function ownerSpoken(label: string | null): string {
  return label ? `recorded by ${label}` : '';
}
