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

export type CaptureIssue = 'one-sided' | null;

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

/**
 * Whether this session's missing read is a one-sided recording.
 *
 * A LATER DISSECT WINS, always. Re-transcribing or re-labelling the speakers can
 * rescue a one-sided call, and when it does the session has a real read — so the
 * badge must disappear rather than linger as a permanent mark against a call that
 * is now fine. This mirrors the web's rule exactly (`!dissect.has(id) && reason
 * === "no_agent_turns"`), because two implementations of one verdict is how the
 * app and the dashboard end up disagreeing about the same call.
 *
 * ONLY `no_agent_turns` COUNTS. A `no_signal` session was captured properly and
 * simply had little in it; telling that rep their audio failed would send them to
 * re-record a call that recorded fine.
 */
export function captureIssueFor(
  hasDissect: boolean,
  latestAttemptReason: AttemptReason | null | undefined,
): CaptureIssue {
  if (hasDissect) return null;
  return latestAttemptReason === 'no_agent_turns' ? 'one-sided' : null;
}

/** One attempt event, reduced to what the verdict needs. */
export type AttemptEvent = {
  subject: string | null;
  createdAt: string | null;
  reason: AttemptReason | null;
};

/**
 * The LATEST attempt reason per session.
 *
 * Latest, not first: a session can be attempted repeatedly, and only the most
 * recent verdict describes the recording as it now stands. An undated event
 * loses to a dated one rather than winning by arriving later in the array,
 * because array order is not a timestamp.
 */
export function latestReasonBySession(events: AttemptEvent[]): Map<string, AttemptReason> {
  const best = new Map<string, { at: number; reason: AttemptReason }>();
  for (const e of events) {
    const id = sessionIdFromSubject(e.subject);
    if (!id || !e.reason) continue;
    const at = e.createdAt ? Date.parse(e.createdAt) : Number.NaN;
    const when = Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY;
    const prev = best.get(id);
    if (!prev || when > prev.at) best.set(id, { at: when, reason: e.reason });
  }
  const out = new Map<string, AttemptReason>();
  for (const [id, v] of best) out.set(id, v.reason);
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
