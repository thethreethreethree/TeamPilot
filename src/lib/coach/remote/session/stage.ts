/**
 * Where a remote session is in processing — DERIVED, because coaching_sessions.status is only
 * active / ended / reviewed (0070) and has no column for the stages (RSS Phase 1 step 4, Gong F6.6).
 *
 * Every input is something that already exists for a real reason (the audio pointer, the transcript, the
 * after-pitch analysis, the pitch score, a recorded failure), so the chip cannot claim a stage the data does not
 * show. PURE, so the order of the checks is tested rather than eyeballed. The labels come from state.ts's
 * STAGE_CHIPS, the one list of what a rep sees.
 *
 * Not modelled here: 'awaiting_outcome'. Whether a phone/video session must have an outcome before processing is
 * an open founder decision (conflicts with the 2026-08-29 "outcome prompt stays skippable" ruling), so the chip
 * neither waits for an outcome nor asks for one.
 */
import { NOT_SCORED_REASONS, type SessionFailureCode, type SessionState } from './state';

export type StageFacts = {
  status: 'active' | 'ended' | 'reviewed';
  hasAudio: boolean;
  segmentCount: number;
  hasAnalysis: boolean;
  scored: boolean;
  /** Most recent recorded failure for the session, if any. */
  failure: SessionFailureCode | null;
};

export type Stage = { state: SessionState; failure: SessionFailureCode | null };

export function remoteStage(f: StageFacts): Stage {
  if (f.status === 'active') return { state: 'live', failure: null };
  if (f.scored) return { state: 'scored', failure: null };
  if (f.failure) {
    const notScored = (NOT_SCORED_REASONS as readonly string[]).includes(f.failure);
    return { state: notScored ? 'not_scored' : 'failed', failure: f.failure };
  }
  if (f.segmentCount === 0) return { state: f.hasAudio ? 'transcribing' : 'uploading', failure: null };
  if (!f.hasAnalysis) return { state: 'analyzing', failure: null };
  return { state: 'scoring', failure: null };
}
