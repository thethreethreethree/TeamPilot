/**
 * Every value the Remote Sales System needs that John has NOT decided yet.
 *
 * Rule: nothing here is a plausible guess. A value is either:
 *   - 'NOT DECIDED'  -> the code that needs it throws NotDecidedError, so the gap is loud, or
 *   - TODAY          -> today's live ELOSTATE behaviour, kept on purpose until he decides.
 *
 * To decide: replace the value, delete the matching row in docs/00-OPEN-DECISIONS.md's
 * "stands in today" column, and append a line to BUILD-PLAN/00-BRIEF.md's decisions log.
 */

export const NOT_DECIDED = 'NOT DECIDED' as const;
export type NotDecided = typeof NOT_DECIDED;

export class NotDecidedError extends Error {
  constructor(public readonly decision: string, detail: string) {
    super(`${decision} is NOT DECIDED (see docs/00-OPEN-DECISIONS.md). ${detail}`);
    this.name = 'NotDecidedError';
  }
}

/** D2 - Do company admins keep company-wide access once managers see only their teams?
 *  TODAY: yes. Kept so nobody loses access on the day the reporting tree ships. */
export const COMPANY_ADMINS_SEE_ALL: boolean = true;

/** D4 - Account lockout: how many failures, in what window, locked for how long.
 *  Gong's figure (5 failures, 60 min) is in GONG_LOCKOUT_REFERENCE for comparison only. */
export interface LockoutPolicy { maxFailures: number; windowMinutes: number; lockMinutes: number }
export const LOCKOUT_POLICY: LockoutPolicy | NotDecided = NOT_DECIDED;
export const GONG_LOCKOUT_REFERENCE: LockoutPolicy = { maxFailures: 5, windowMinutes: 60, lockMinutes: 60 };

/** D5 - Minimum transcript before a session is scored.
 *  TODAY: one rep segment (generatePitchScore.ts:47). Gong skips under 100 words. */
export const SCORING_FLOOR: { minRepSegments: number } = { minRepSegments: 1 };
export const SCORING_FLOOR_IS_TODAYS_BEHAVIOUR = true;

/** D8 - What counts as "feedback given" and as "listened".
 *  GONG_FEEDBACK_RULES / GONG-like listen rule are offered as one option, not chosen. */
export const FEEDBACK_POLICY: 'NOT DECIDED' | 'GONG_RULES' | 'ALL_MANAGER_ACTIONS' = NOT_DECIDED;
export const LISTENED_THRESHOLD: { minSeconds: number } | { minShareOfSession: number } | NotDecided = NOT_DECIDED;

/** D15 - Number redaction: on/off and the digit-run length. Function exists; switched off. */
export const REDACTION: { enabled: false } | { enabled: true; minDigits: number } = { enabled: false };

/** D16 - Upload size limit for remote calls. TODAY: 25 MB (src/lib/storage/assets.ts:21). */
export const UPLOAD_MAX_BYTES: number = 25 * 1024 * 1024;
export const UPLOAD_MAX_IS_TODAYS_BEHAVIOUR = true;

/** D19 - Interaction-stat parameters. [ASSUMED] values, labelled as such in docs/04. */
export const ACKNOWLEDGEMENT_MAX_MS = 1000; // [ASSUMED] utterances this short don't count as a speaker switch
export const INTERACTIVITY_WINDOW_MS = 5 * 60 * 1000; // [OBSERVED] Gong: per 5-minute block
export const INTERACTIVITY_CAP = 10; // [OBSERVED] Gong: capped at 10
