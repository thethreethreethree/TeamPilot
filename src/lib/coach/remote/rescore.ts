/**
 * F15.15 - the re-score loophole.
 * [OBSERVED] pitch-score/route.ts:103 passes skipIfScored:false for the session owner, and a
 * re-score replaces the score and deletes its evidence rows (0254_pitch_score_verdicts.sql:117).
 * The score button is already hidden from reps, so refusing reps at the API matches the UI's intent.
 * D3 (who may re-score, and whether old versions are kept) is open; the stand-in is below.
 */
export type Caller = { id: string; isManagerOfRep: boolean };

export class RescoreRefused extends Error {}

export interface ScoreRequest { caller: Caller; repId: string; alreadyScored: boolean; reason?: string }

/** Returns the skipIfScored value the scorer must be called with, or throws. */
export function resolveScoreRequest(req: ScoreRequest): { skipIfScored: boolean; archiveFirst: boolean } {
  const isOwner = req.caller.id === req.repId;
  if (!req.alreadyScored) return { skipIfScored: true, archiveFirst: false };
  if (isOwner && !req.caller.isManagerOfRep) {
    throw new RescoreRefused('Reps cannot re-score their own sessions. Use a dispute instead.');
  }
  if (!req.caller.isManagerOfRep) throw new RescoreRefused('Only a manager of this rep can re-score');
  if (!req.reason || req.reason.trim().length < 3) {
    throw new RescoreRefused('A re-score needs a reason, as overrides do');
  }
  // Stand-in for D3: keep the old version (archive) before replacing.
  return { skipIfScored: false, archiveFirst: true };
}

/** Points are banked once per session [OBSERVED bankPoints.ts:23]; a re-score never re-banks. */
export const RESCORE_CHANGES_POINTS = false;
