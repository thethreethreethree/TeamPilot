import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";
import type { PitchScoreResult } from "./generatePitchScore";

/**
 * Persist a scored pitch — the last link in Project 1.
 *
 * Service-role by necessity: `pitches` has no insert policy at all (0252), because a rep must
 * never be able to write their own score. The whole write goes through the `store_pitch_score`
 * RPC (0254) so the score and its evidence land in ONE transaction — a Pitch Score with no
 * element rows is the unexplainable number the rubric exists to prevent, and the Dispute button
 * would have nothing to point at.
 *
 * WHAT THIS FILE IS CAREFUL NOT TO DO: decide anything. Every number written here comes from the
 * breakdown scorePitch() returned, never from re-reading the rubric against the raw detections.
 * That is not tidiness — the first draft of this file did re-derive, and it was wrong four ways
 * at once. It would have stored bonuses the scorer rejected for low confidence, ignored the
 * repeatable ceilings and the +30 pool cap, and written an "Objection handling: missed" row
 * against pitches where the customer never objected. Every one of those puts a row on the rep's
 * Pitch detail that does not add up to the score printed at the top of the same screen, and the
 * scorer is the only thing that knows the right answer. This file joins evidence onto verdicts.
 *
 * The caller gates who may trigger a scoring run; this function does not check permissions,
 * exactly like replaceSessionTranscript in the same layer.
 */

export type StorePitchScoreArgs = {
  companyId: string;
  repId: string;
  recordedAt: string;
  /** The coaching session this pitch came from, when it came from one. Also the re-score key. */
  sessionId?: string | null;
  durationS?: number | null;
  audioUrl?: string | null;
  transcript?: string | null;
  outcome?: "sold" | "follow_up" | "no_sale" | null;
  /** The successful result from generatePitchScore. A failure must never reach here. */
  result: Extract<PitchScoreResult, { ok: true }>;
};

/**
 * Display band for the score.
 *
 * Lives here rather than in rubric.ts because the bands are a presentation choice the founder may
 * retune and nothing computes with them. The thresholds are an ASSUMPTION, stated as one: the only
 * evidence available is the mockups showing "Strong" beside 80.3 and "Solid" beside 77.0, which
 * pins one boundary between those two numbers and leaves the rest inferred.
 */
export function bandFor(total: number): string {
  if (total >= 80) return "Strong";
  if (total >= 60) return "Solid";
  if (total >= 40) return "Developing";
  return "Early";
}

/** First detection wins, matching how the scorer resolves a repeated id. */
function firstById<T>(items: readonly T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(key(item))) map.set(key(item), item);
  return map;
}

type EventRow = {
  type: "bonus" | "violation" | "rejected_bonus";
  item_id: string;
  points: number;
  timestamp_s: number | null;
  evidence: string | null;
  confidence: number | null;
};

/**
 * Store the score. Returns the pitch id, or null when nothing was written.
 *
 * Null means FAILED, never "stored an empty pitch". The caller must not treat it as success — the
 * whole point of the ok/failure split in generatePitchScore is that no code path turns a problem
 * into a real-looking zero on a rep's leaderboard.
 */
export async function storePitchScore(args: StorePitchScoreArgs): Promise<string | null> {
  const { score, elements, bonuses, violations } = args.result;

  // Evidence, keyed for lookup. The verdicts below drive what gets stored; these only supply the
  // quote and the timestamp that make a grade disputable.
  const rawElements = firstById(elements, (e) => e.elementId);
  const rawBonuses = firstById(bonuses, (b) => b.bonusId);
  const rawViolations = firstById(violations, (v) => v.violationId);

  const elementRows = score.elementBreakdown.map((scored) => {
    const raw = rawElements.get(scored.elementId);
    return {
      element_id: scored.elementId,
      grade: scored.grade,
      points: scored.points,
      timestamp_s: raw?.timestampS ?? null,
      evidence: raw?.evidence ?? null,
    };
  });

  const eventRows: EventRow[] = [
    ...score.bonusBreakdown.map((scored) => {
      const raw = rawBonuses.get(scored.bonusId);
      return {
        type: "bonus" as const,
        item_id: scored.bonusId,
        // The AWARDED value, after the repeatable ceiling and the +30 pool cap. Storing the
        // rubric's face value instead is how the events stop summing to `bonus`.
        points: scored.points,
        timestamp_s: raw?.timestampS ?? null,
        evidence: raw?.evidence ?? null,
        confidence: raw?.confidence ?? null,
      };
    }),
    ...score.violationBreakdown.map((scored) => {
      const raw = rawViolations.get(scored.violationId);
      return {
        type: "violation" as const,
        item_id: scored.violationId,
        points: scored.deduction,
        timestamp_s: raw?.timestampS ?? null,
        evidence: raw?.evidence ?? null,
        confidence: null,
      };
    }),
  ];

  // Bonuses the scorer SAW but did not award, because the audio inference was below the confidence
  // floor. Worth 0 and stored anyway: scorePitch collects these so "a dispute has something to
  // point at", and that promise is only kept if they survive to the database. It turns "the AI
  // didn't see it" into "it heard it at 0.62, below the 0.80 floor" — which a manager can settle.
  const awarded = new Set(score.bonusBreakdown.map((b) => b.bonusId));
  for (const bonusId of new Set(score.rejectedLowConfidence)) {
    // A bonus detected twice can be rejected once and awarded once. The award wins; recording it
    // as rejected as well would show the rep a contradiction on one screen.
    if (awarded.has(bonusId)) continue;
    const raw = rawBonuses.get(bonusId);
    eventRows.push({
      type: "rejected_bonus",
      item_id: bonusId,
      points: 0,
      timestamp_s: raw?.timestampS ?? null,
      evidence: raw?.evidence ?? null,
      confidence: raw?.confidence ?? null,
    });
  }

  // The RPC refuses this too, but failing before the round trip gives a clearer message and keeps
  // the guarantee stated in both places — this is the one condition that must never reach storage.
  if (elementRows.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[storePitchScore] refused: the scorer honoured no element grades for rep=${args.repId} session=${args.sessionId ?? "none"}. A score with no evidence is not storable.`
    );
    return null;
  }

  const sb = createServiceRoleClient();
  const { data, error } = await sb.rpc("store_pitch_score", {
    p_company_id: args.companyId,
    p_rep_id: args.repId,
    p_recorded_at: args.recordedAt,
    p_rubric_version: score.rubricVersion,
    p_base: score.base,
    p_bonus: score.bonus,
    p_violations: score.violations,
    p_total: score.total,
    p_qualifying: score.qualifying,
    p_not_qualifying_reason: score.notQualifyingReason,
    p_delivery_scaled: score.deliveryScaled,
    p_elements: elementRows,
    p_events: eventRows,
    p_section_points: score.sectionPoints,
    p_session_id: args.sessionId ?? null,
    p_duration_s: args.durationS ?? null,
    p_audio_url: args.audioUrl ?? null,
    p_transcript: args.transcript ?? null,
    p_outcome: args.outcome ?? null,
    p_band: bandFor(score.total),
  });

  if (error) {
    // Logged with the detail, returned as a bare null: the caller learns "this did not store", and
    // the database's own message — which can name columns and constraints — stays server-side
    // (CWE-209). Not swallowed into a success-shaped value; null here is unambiguous.
    // eslint-disable-next-line no-console
    console.error(
      `[storePitchScore] rpc failed rep=${args.repId} session=${args.sessionId ?? "none"}: ${error.message}`
    );
    return null;
  }

  if (typeof data !== "string" || !data) {
    // A non-error reply that is not an id means the RPC's contract changed under us. Loud, because
    // a caller treating this as success would report a stored score that does not exist.
    // eslint-disable-next-line no-console
    console.error(
      `[storePitchScore] rpc returned no pitch id rep=${args.repId} session=${args.sessionId ?? "none"} (got ${typeof data}).`
    );
    return null;
  }

  return data;
}
