/**
 * F16.1/F16.2/F16.4/F16.10 - feedback requests, what counts as feedback, listening.
 * D8 is NOT DECIDED: countsAsFeedback() throws until a policy is chosen.
 * Inputs are rows that ALREADY exist in ELOSTATE [OBSERVED]:
 *   recording_comments.sent_to_rep (0259), pitch_score_overrides (0255),
 *   dispute answer events (readDisputes.ts), pattern 'coached' events (0258).
 */
import { FEEDBACK_POLICY, LISTENED_THRESHOLD, NotDecidedError } from './decisions';

export type CoachingEvent =
  | { kind: 'comment_sent_to_rep'; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: 'comment_draft'; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: 'score_override'; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: 'dispute_answered'; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: 'pattern_coached'; managerId: string; repId: string; at: Date }
  | { kind: 'ai_score'; repId: string; at: Date; sessionId: string }
  | { kind: 'own_session_action'; managerId: string; repId: string; at: Date; sessionId: string };

/** Gong's rules, adapted to our row types [OBSERVED teardown F16.2]: AI scores never count,
 *  acting on your own session never counts, drafts never reach the rep. */
export function gongRules(e: CoachingEvent): boolean {
  switch (e.kind) {
    case 'comment_sent_to_rep':
    case 'score_override':
    case 'dispute_answered':
    case 'pattern_coached':
      return true;
    default:
      return false;
  }
}

/** Every manager action that reaches the rep, including drafts later sent. Option for D8. */
export function allManagerActions(e: CoachingEvent): boolean {
  return e.kind !== 'ai_score' && e.kind !== 'own_session_action';
}

export function countsAsFeedback(e: CoachingEvent): boolean {
  if (FEEDBACK_POLICY === 'NOT DECIDED') throw new NotDecidedError('D8 feedback policy', 'Coaching metrics stay hidden.');
  return FEEDBACK_POLICY === 'GONG_RULES' ? gongRules(e) : allManagerActions(e);
}

/** A feedback request is open until the recipient manager acts on that session after it. */
export function isRequestOpen(
  request: { sessionId: string; managerId: string; createdAt: Date },
  events: CoachingEvent[],
  rule: (e: CoachingEvent) => boolean,
): boolean {
  return !events.some(
    (e) => 'sessionId' in e && e.sessionId === request.sessionId && 'managerId' in e &&
      e.managerId === request.managerId && e.at >= request.createdAt && rule(e),
  );
}

/** Merge listen ranges and decide whether a session counts as listened (D8). */
export function listenedSeconds(ranges: [number, number][]): number {
  const s = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0, curA = -1, curB = -1;
  for (const [a, b] of s) {
    if (a > curB) { if (curB > curA) total += curB - curA; curA = a; curB = b; }
    else curB = Math.max(curB, b);
  }
  if (curB > curA) total += curB - curA;
  return total / 1000;
}

export function counted(ranges: [number, number][], sessionMs: number): boolean {
  if (LISTENED_THRESHOLD === 'NOT DECIDED') throw new NotDecidedError('D8 listened threshold', 'Listen events are still recorded.');
  const secs = listenedSeconds(ranges);
  return 'minSeconds' in LISTENED_THRESHOLD
    ? secs >= LISTENED_THRESHOLD.minSeconds
    : sessionMs > 0 && (secs * 1000) / sessionMs >= LISTENED_THRESHOLD.minShareOfSession;
}
