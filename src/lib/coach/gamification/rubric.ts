import "server-only";
import type { ScoreKey } from "@/lib/coach/v5/summaryTypes";

/**
 * Gamification — Phase 1 constants + row types. NO logic here (the points-mapping function is Phase 2).
 *
 * DECISION (docs/gamification/DECISIONS.md): points REUSE the existing after-pitch dimension scores
 * (src/lib/coach/v5/salesScore.ts → ScoreCategory[]), never a new judge. A session's banked points =
 * round(mean of the scored dimensions × 10) → a 0–100 scale ("you ran that one at 72/100"). These constants are
 * the single source for the scale + threshold + which dimensions count, so no literal is scattered through code.
 */

/** Rubric version stamped on every ledger row + notification, so a scale change never silently rewrites history. */
export type RubricVersion = "v1";
export const RUBRIC_VERSION: RubricVersion = "v1";

/**
 * The existing after-pitch dimensions that feed points — the full set the session is already scored on
 * (5 LLM-judged + 2 computed). Reusing ScoreKey keeps this in lockstep with the scorer; if a dimension is added
 * there, decide here whether it counts. Value Framing (rubric D-C) has no existing equivalent yet (deferred).
 */
export const POINTS_DIMENSIONS: readonly ScoreKey[] = [
  "opener",
  "objection",
  "tone",
  "close",
  "next_step",
  "talk_ratio",
  "question_rate",
] as const;

// Points scale + bands live in the client-safe single source (bands.ts) so the rep Arena UI can share them without
// pulling this server-only module. Re-exported here so existing importers of rubric.ts are unchanged (§2.2).
export { POINTS_SCALE_MAX, STRONG_SESSION_THRESHOLD, BANDS, BAND_LABEL, bandFor, type PointsBand } from "./bands";
import type { PointsBand } from "./bands"; // local binding for the row types below

// ── Row types (mirror migration 0242) ────────────────────────────────────────────────────────────────────────

/** reason on a ledger row. `session_score` is the once-per-session bank; the others are audit-trail corrections. */
export type LedgerReason = "session_score" | "correction" | "rescore";

/** A row of agent_point_ledger. Append-only: SUM(points) per (agent, period) is the truth; never a cached total. */
export interface AgentPointLedgerRow {
  id: string;
  company_id: string;
  agent_id: string;
  session_id: string | null;
  points: number; // may be negative (corrections)
  reason: LedgerReason;
  detail: {
    rubric_version?: RubricVersion;
    band?: PointsBand;
    dimensions?: Partial<Record<ScoreKey, number>>; // the 0–10 dimension scores the points were derived from
  };
  created_by: string | null; // null = system
  created_at: string;
}

export type NotificationType = "strong_session" | "deal_closed";

/** A row of manager_notifications. Recipient = a company admin (no per-agent manager FK exists — fan out). */
export interface ManagerNotification {
  id: string;
  company_id: string;
  recipient_id: string;
  agent_id: string;
  session_id: string | null;
  type: NotificationType;
  payload: {
    agent_name?: string;
    total?: number; // for strong_session
    band?: PointsBand;
    deal_value?: number | null; // for deal_closed
  };
  created_at: string;
  read_at: string | null;
}
