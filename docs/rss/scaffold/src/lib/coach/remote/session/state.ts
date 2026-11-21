/**
 * The remote sales session lifecycle - the ONE place it is defined.
 *
 * Entity: a row in coaching_sessions with session_kind = 'sales' and context in ('phone','video').
 * Door sessions (context 'in_person' + door_knocks) keep their own Door Log machine; nothing here
 * changes them.
 *
 * Mapping to persisted columns is done in the route layer: the live repo's status columns were not
 * readable from the plan's environment (see README-PLACEMENT.md, step 2). This file is the rule;
 * the route translates.
 */

import { SCORING_FLOOR } from '../decisions';

export const REMOTE_CHANNELS = ['phone', 'video'] as const;
export type RemoteChannel = (typeof REMOTE_CHANNELS)[number];

/** Existing session outcome values [OBSERVED: 0077_sales_session_capture.sql:28]. */
export const SESSION_OUTCOMES = ['sold', 'follow_up', 'no_sale', 'no_contact', 'undecided'] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export type SessionState =
  | 'live' // rep is on the call (live coaching may run)
  | 'uploading' // recording or file arriving
  | 'awaiting_outcome' // call ended; rep must pick an outcome before the session closes
  | 'transcribing'
  | 'analyzing'
  | 'scoring'
  | 'scored'
  | 'not_scored' // processed, deliberately not scored (below floor / not a sales call)
  | 'failed';

export type Actor = 'rep' | 'manager' | 'system';

/** Closed list of reasons a remote session was not analysed or scored. Shown to managers.
 *  [INFERRED] from pitchFailureMessage.ts:16 and captureGap.ts:30, made into a closed list. */
export const FAILURE_REASONS = [
  'NO_AUDIO',
  'NO_SPEECH',
  'ONE_SIDED_CAPTURE',
  'TOO_LARGE',
  'TRANSCRIBE_TIMEOUT',
  'AI_UNAVAILABLE',
  'AI_QUOTA',
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export const NOT_SCORED_REASONS = ['BELOW_SCORING_FLOOR', 'NOT_A_SALES_CALL'] as const;
export type NotScoredReason = (typeof NOT_SCORED_REASONS)[number];

type Transition = { from: SessionState[]; to: SessionState; by: Actor[] };

const TRANSITIONS: Transition[] = [
  { from: ['live'], to: 'uploading', by: ['rep', 'system'] },
  { from: ['live', 'uploading'], to: 'awaiting_outcome', by: ['rep', 'system'] },
  { from: ['awaiting_outcome'], to: 'transcribing', by: ['rep'] }, // only via closeWithOutcome()
  { from: ['transcribing'], to: 'analyzing', by: ['system'] },
  { from: ['analyzing'], to: 'scoring', by: ['system'] },
  { from: ['analyzing'], to: 'not_scored', by: ['system'] },
  { from: ['scoring'], to: 'scored', by: ['system'] },
  { from: ['uploading', 'transcribing', 'analyzing', 'scoring'], to: 'failed', by: ['system'] },
  { from: ['failed'], to: 'transcribing', by: ['system', 'manager'] }, // retry / retranscribe
  { from: ['scored'], to: 'scoring', by: ['manager'] }, // re-score: managers only (D3)
];

export class TransitionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TransitionError';
  }
}

export function canTransition(from: SessionState, to: SessionState, by: Actor): boolean {
  return TRANSITIONS.some((t) => t.to === to && t.from.includes(from) && t.by.includes(by));
}

export function transition(from: SessionState, to: SessionState, by: Actor): SessionState {
  if (!canTransition(from, to, by)) {
    throw new TransitionError(`${by} cannot move a remote session from '${from}' to '${to}'`);
  }
  if (from === 'awaiting_outcome' && to === 'transcribing') {
    throw new TransitionError("Use closeWithOutcome(): a remote session can't close without an outcome");
  }
  return to;
}

/**
 * F25.9: remote sessions must not close without an outcome.
 * [OBSERVED] deriveGoal.ts:13 finds ZERO sales sessions with an outcome in production, so
 * close rate and the day target cannot use phone or video work today.
 */
export function closeWithOutcome(
  from: SessionState,
  outcome: string | null | undefined,
  by: Actor,
): { state: SessionState; outcome: SessionOutcome } {
  if (from !== 'awaiting_outcome') {
    throw new TransitionError(`A session closes from 'awaiting_outcome', not '${from}'`);
  }
  if (by !== 'rep') throw new TransitionError('Only the rep who ran the session picks its outcome');
  if (!outcome || !(SESSION_OUTCOMES as readonly string[]).includes(outcome)) {
    throw new TransitionError('A remote session needs an outcome before it closes');
  }
  return { state: 'transcribing', outcome: outcome as SessionOutcome };
}

/** D5 - scoring floor. Today's behaviour: at least one rep segment. */
export function scoringDecision(
  repSegments: number,
  isSalesCall: boolean,
): { score: true } | { score: false; reason: NotScoredReason } {
  if (!isSalesCall) return { score: false, reason: 'NOT_A_SALES_CALL' };
  if (repSegments < SCORING_FLOOR.minRepSegments) return { score: false, reason: 'BELOW_SCORING_FLOOR' };
  return { score: true };
}

/** Stage chips (F6.6): every processing state the rep can see, in order. */
export const STAGE_CHIPS: { state: SessionState; label: string }[] = [
  { state: 'uploading', label: 'Uploading' },
  { state: 'transcribing', label: 'Transcribing' },
  { state: 'analyzing', label: 'Analysing' },
  { state: 'scoring', label: 'Scoring' },
  { state: 'scored', label: 'Ready' },
];
