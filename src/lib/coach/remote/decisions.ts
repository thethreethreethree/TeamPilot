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

/** D1 - DECIDED 2026-11-15 (founder picker): the Remote Sales System covers PHONE and VIDEO sales
 *  sessions. Door-to-door is unchanged except the shared foundations (reporting tree, re-score lock,
 *  AI cost ledger), which cannot be split by channel. */
export const RSS_CHANNELS = ['phone', 'video'] as const;

/** D2 - DECIDED 2026-11-15 (founder picker): company admins keep company-wide access once managers
 *  see only their teams — today's behaviour, so nobody loses access the day the tree ships. */
export const COMPANY_ADMINS_SEE_ALL: boolean = true;

/** D3 - DECIDED 2026-11-15 (founder picker): a manager re-score archives the old score first and
 *  does NOT re-apply earlier overrides; it flags them so the manager decides. See rescore.ts. */
export const RESCORE_REAPPLIES_OVERRIDES: boolean = false;

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

/** D15 - Number redaction: on/off and the digit-run length. DECIDED 2026-11-22 by the founder (picker): ON for runs of
 *  9+ digits — card numbers, SSNs, account numbers (and 10-digit phone numbers). New lines only; see redact.ts. */
export const REDACTION: { enabled: false } | { enabled: true; minDigits: number } = { enabled: true, minDigits: 9 };

/** D16 - Upload size limit for remote calls. TODAY: AGENT_MAX_BYTES in src/lib/storage/assets.ts (25 MB), used
 *  as-is — not copied here, so the two cannot drift (§2.2). Deciding D16 means changing that constant (or giving
 *  remote sessions their own), and the storage quota (docs/SUPABASE-QUOTA-OUTAGE-2026-11-11.md) with it. */
export const UPLOAD_MAX_IS_TODAYS_BEHAVIOUR = true;

/** D19 - Interaction-stat parameters. [ASSUMED] values, labelled as such in docs/04. */
export const ACKNOWLEDGEMENT_MAX_MS = 1000; // [ASSUMED] utterances this short don't count as a speaker switch
export const INTERACTIVITY_WINDOW_MS = 5 * 60 * 1000; // [OBSERVED] Gong: per 5-minute block
export const INTERACTIVITY_CAP = 10; // [OBSERVED] Gong: capped at 10
