/**
 * Why a call has no coach read, when the reason is the recording itself.
 *
 * A session recorded with only ONE side captured — the rep's own voice missing,
 * so zero agent turns — can still produce an after-pitch summary from the
 * customer's side, but it can never produce the full read. Until the web named
 * it, that session just looked broken: no Dissect badge, no reason given, and a
 * backfill that re-processed it forever.
 *
 * WHAT THE REP NEEDS TO KNOW is that this is a CAPTURE problem they can fix by
 * re-recording or re-labelling the speakers — not a fault in the app, and not
 * "still processing". Those three read completely differently to somebody
 * deciding whether to wait, retry, or go back to the door.
 *
 * WHY THE APP COMPUTES THIS ITSELF rather than reading the web's list route.
 * The web sets `captureIssue` inside `GET /api/coach/sales-session/list`, and
 * this app never calls that route: its Sessions screen reads `coaching_sessions`
 * straight from Supabase, because the SELECT policies already scope a rep to
 * their own rows and a same-company manager to the team. So the field the web
 * hands its dashboard does not exist here — the same verdict is derived from the
 * same two events instead, which RLS lets a rep read for their own sessions
 * (checked against production, 10 September).
 *
 * PURE, so the difference between "broken", "not yet" and "one-sided" is a
 * tested rule rather than a condition assembled inside a list row.
 */

/** The event the server writes when a dissect attempt produced nothing. */
export const DISSECT_ATTEMPTED = 'coach.dissect_attempted';
/** The event the server writes when a dissect DID get produced. */
export const DISSECT_GENERATED = 'coach.dissect_generated';

/**
 * The reason a dissect attempt came back empty.
 *
 *   no_agent_turns  the rep's side was not captured. One-sided.
 *   no_signal       the rep WAS captured, the model ran, and there was not
 *                   enough in the conversation to read. Not a capture problem,
 *                   and deliberately NOT surfaced as one.
 */
export type AttemptReason = 'no_agent_turns' | 'no_signal';

/**
 * WHICH empty the coach hit - written beside `reason` from 10 September 2026 (server 3828776b).
 *
 * `reason` has only two words, and 92 of 100 stored declines say `no_signal`, which covers four
 * genuinely different events. The rep needs them apart, because two are about their call and two
 * are about the coach:
 *
 *   llm_empty       the model returned nothing at all. The coach failed; the recording is fine.
 *   unparsable      the model answered in a shape we could not read. Same: the coach failed.
 *   threw           an error on the path. Same again.
 *   no_strengths    the coach DID read the call and found nothing to call out. Nothing failed.
 *   suppressed      a policy decline. Nothing failed.
 *   no_agent_turns  the rep's side was never captured - the one-sided case.
 */
export type DissectShape =
  | 'no_agent_turns'
  | 'suppressed'
  | 'llm_empty'
  | 'unparsable'
  | 'no_strengths'
  | 'threw';

/**
 * Why this call has no read, in the only terms that change what a rep should DO.
 *
 *   'one-sided'   your side was not captured - re-record, or say which voice is yours.
 *   'unfinished'  the coach stopped before producing anything - your recording is fine, rebuild it.
 *   null          nothing to say. Either the read exists, or the coach read the call and honestly
 *                 found little in it, or this is an older decline that never recorded which it was.
 */
export type ReadIssue = 'one-sided' | 'unfinished' | null;

/**
 * Pull the session id out of an event's subject.
 *
 * The column holds `"sales_session:<uuid>"`, not a bare id — a detail the spec
 * does not mention and the reason a naive `subject === sessionId` match would
 * silently find nothing and report every session as fine.
 */
export function sessionIdFromSubject(subject: string | null | undefined): string | null {
  const s = (subject ?? '').trim();
  const prefix = 'sales_session:';
  if (!s.startsWith(prefix)) return null;
  const id = s.slice(prefix.length).trim();
  return id.length > 0 ? id : null;
}

/** The shapes that mean the COACH failed, not the call - the only ones worth offering a retry for. */
const COACH_FAILED: ReadonlySet<string> = new Set<DissectShape>(['llm_empty', 'unparsable', 'threw']);

/**
 * Why this session has no read.
 *
 * A LATER DISSECT WINS, always. Re-transcribing, re-labelling the speakers, or simply rebuilding can
 * rescue a call, and when it does the session has a real read - so the badge must disappear rather
 * than linger as a permanent mark against a call that is now fine.
 *
 * ONE-SIDED IS UNCHANGED, still keyed on `no_agent_turns` alone. The old rule that a `no_signal`
 * session must NOT be shown as a capture problem is right and is kept: telling that rep their audio
 * failed would send them to re-record a call that recorded fine.
 *
 * WHAT IS NEW is that `no_signal` is no longer one thing. Measured on production 10 September 2026:
 * 92 of 100 declines say `no_signal`, and they are systematically the LONGER calls - median 683
 * transcript words against 341 for the ones that succeeded. Thin content would be SHORT. So for most
 * of these the story was never "there was little to read", and the rep was shown NOTHING AT ALL: no
 * read, no badge, no explanation, on more than half of every session recorded.
 *
 * Now the coach records which empty it hit, and only the three that mean IT failed are surfaced.
 * `no_strengths` stays silent, because there the coach really did read the call and found little -
 * exactly the case the original rule was protecting.
 *
 * AN OLDER DECLINE CARRIES NO SHAPE and stays silent too. We genuinely do not know which it was, and
 * guessing would put a retry in front of a rep for a call that may have nothing to give.
 */
export function readIssueFor(
  hasDissect: boolean,
  latestAttemptReason: AttemptReason | null | undefined,
  latestShape?: DissectShape | null,
): ReadIssue {
  if (hasDissect) return null;
  if (latestAttemptReason === 'no_agent_turns') return 'one-sided';
  return latestShape && COACH_FAILED.has(latestShape) ? 'unfinished' : null;
}

/** One attempt event, reduced to what the verdict needs. */
export type AttemptEvent = {
  subject: string | null;
  createdAt: string | null;
  reason: AttemptReason | null;
  /** Absent on every decline stored before 10 September 2026, and that absence is meaningful. */
  shape?: DissectShape | null;
};

/** The latest attempt for a session: both halves travel together, because the verdict needs both. */
export type LatestAttempt = { reason: AttemptReason; shape: DissectShape | null };

/**
 * The LATEST attempt reason per session.
 *
 * Latest, not first: a session can be attempted repeatedly, and only the most
 * recent verdict describes the recording as it now stands. An undated event
 * loses to a dated one rather than winning by arriving later in the array,
 * because array order is not a timestamp.
 */
export function latestAttemptBySession(events: AttemptEvent[]): Map<string, LatestAttempt> {
  const best = new Map<string, { at: number; reason: AttemptReason; shape: DissectShape | null }>();
  for (const e of events) {
    const id = sessionIdFromSubject(e.subject);
    if (!id || !e.reason) continue;
    const at = e.createdAt ? Date.parse(e.createdAt) : Number.NaN;
    const when = Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY;
    const prev = best.get(id);
    if (!prev || when > prev.at) best.set(id, { at: when, reason: e.reason, shape: e.shape ?? null });
  }
  const out = new Map<string, LatestAttempt>();
  for (const [id, v] of best) out.set(id, { reason: v.reason, shape: v.shape });
  return out;
}

/** What the chip says. Short, because it sits in a row beside four other facts. */
export const ONE_SIDED_CHIP = 'One-sided';

/**
 * The explanation, for the detail screen and the screen reader.
 *
 * Says what happened, what it costs, and what recovers it — in that order,
 * because a rep who reads only the first clause still learns the useful part.
 */
export const ONE_SIDED_BODY =
  'Your side of this call was not captured, so the full read cannot be made from it. Re-record the call, or set which voice is yours, and it can be recovered.';

/** The same fact spoken as a sentence, appended to the row's name. */
export const ONE_SIDED_SPOKEN = 'one-sided recording, your side was not captured';

/** What the chip says when the coach stopped before producing anything. */
export const UNFINISHED_CHIP = 'Read didn’t finish';

/** The same fact spoken as a sentence, appended to the row’s name. */
export const UNFINISHED_SPOKEN = 'the coach did not finish reading this call';
