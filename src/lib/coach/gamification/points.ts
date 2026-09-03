import type { ScoreCategory, ScoreKey } from "@/lib/coach/v5/summaryTypes";
import { BANDS, POINTS_DIMENSIONS, POINTS_SCALE_MAX, type PointsBand } from "./rubric";

/**
 * Gamification Phase 2 — the PURE points mapping. Given the session's EXISTING after-pitch dimension scores
 * (ScoreCategory[], 0–10 each), derive the banked points (0–100) + band. No LLM, no I/O — the score already exists
 * (DECISION: reuse, not a second judge). Testable without a DB or network.
 *
 * points = round(mean of the counted dimensions' scores × 10). Only POINTS_DIMENSIONS count (the existing scorer
 * keys). Round HALF-UP (Math.round: .5 → up) — stated here so a later reader doesn't wonder. Returns null when no
 * counted dimension is present (a not-scoreable / empty session banks nothing — never a fabricated 0).
 */
export interface SessionPoints {
  points: number; // 0..POINTS_SCALE_MAX
  band: PointsBand;
  dimensions: Partial<Record<ScoreKey, number>>; // the 0–10 scores the points were derived from (audit snapshot)
}

const COUNTED = new Set<ScoreKey>(POINTS_DIMENSIONS);

/** Classify a 0..100 total into its band (BANDS is contiguous + covers the range — pinned by rubric.test.ts). */
export function bandFor(points: number): PointsBand {
  const clamped = Math.max(0, Math.min(POINTS_SCALE_MAX, Math.round(points)));
  const hit = BANDS.find((b) => clamped >= b.min && clamped <= b.max);
  return hit!.band; // BANDS covers 0..100 with no gap (tested), so this is always defined
}

export function computeSessionPoints(categories: readonly ScoreCategory[]): SessionPoints | null {
  const counted = categories.filter(
    (c) => COUNTED.has(c.key) && typeof c.score === "number" && Number.isFinite(c.score),
  );
  if (counted.length === 0) return null; // nothing to bank — the session had no scored dimension

  const dimensions: Partial<Record<ScoreKey, number>> = {};
  let sum = 0;
  for (const c of counted) {
    dimensions[c.key] = c.score;
    sum += c.score;
  }
  // mean of 0–10 scores × 10 → 0–100, rounded half-up.
  const points = Math.max(0, Math.min(POINTS_SCALE_MAX, Math.round((sum / counted.length) * 10)));
  return { points, band: bandFor(points), dimensions };
}
