/**
 * Door-screen day target — the only real logic in the home-screen build (docs/2ND MAIN PANEL DASKBOARD).
 *
 * Works a manager-set DAILY SALES GOAL back through two 30-day ratios into the day's door / presentation /
 * sold targets. Pure and DB-free (05-target-engine.md): the caller fetches the goal + ratios, this calculates.
 *
 * The chain (03-number-logic.md), read right-to-left — the goal is known, doors fall out last:
 *   goal → presentations_needed (÷ close ratio) → doors_needed (÷ contact ratio)
 *
 * John's decisions (2026-09-10, recorded in INSPECTION.md):
 *   - Target works back from a daily SALES goal, set by the manager per rep (Q1).
 *   - All three dials have targets (Q2): sold target = goal; presentations target = goal ÷ close ratio.
 *   - Two ratios, 30-day window (Q4): close = sales÷presentations, contact = presentations÷doors.
 *   - New rep / thin history → a fixed STARTER until they qualify (Q4). "Qualify" = enough data (see caller).
 *   - Round UP at every step (03) — rounding down hands a target that can't reach the goal.
 *   - Floor/ceiling on the door number, and clamp overshoot at the ring (defaults below, John to veto).
 */

/** Starter ratios used until a rep qualifies (the mockup's figures: 1 sale / 9 presentations, 1 pres / 4.4
 *  doors → goal 2 gives 18 presentations, 80 doors). Founder-revisable. */
export const STARTER_CLOSE_RATIO = 1 / 9;
export const STARTER_CONTACT_RATIO = 1 / 4.4;

/** A door target below the floor or above the ceiling is useless either way (05-target-engine.md).
 *  [ASSUMED default — John to confirm.] */
export const DOORS_FLOOR = 20;
export const DOORS_CEILING = 200;

export type DayTargetInput = {
  /** The manager-set daily sales goal for this rep. */
  salesGoal: number;
  /** sales ÷ presentations over the 30-day window, or null when there isn't enough history. */
  closeRatio: number | null;
  /** presentations ÷ doors over the 30-day window, or null when there isn't enough history. */
  contactRatio: number | null;
  /** True once the rep has enough history to trust their OWN ratios (caller decides the threshold —
   *  currently ≥10 presentations AND ≥1 sale in the window). When false, the starter ratios are used. */
  qualified: boolean;
};

export type DayTarget = {
  doorsTarget: number;
  presentationsTarget: number;
  soldTarget: number;
  /** True when the starter ratios were used because the rep hasn't qualified (or a ratio was unusable). */
  usedStarter: boolean;
};

const ceilPos = (n: number) => Math.max(0, Math.ceil(n));
const usable = (r: number | null): r is number => typeof r === "number" && Number.isFinite(r) && r > 0;

/**
 * Compute the day's targets. Never throws and never divides by zero: a null/zero/absurd ratio, or an
 * unqualified rep, falls back to the starter ratios. A non-positive goal yields all-zero targets (the
 * manager hasn't set a real goal yet) rather than a fabricated number.
 */
export function calculateDayTarget(input: DayTargetInput): DayTarget {
  const soldTarget = ceilPos(input.salesGoal);
  if (soldTarget <= 0) {
    // No real goal set → no target to show. The screen renders the starter/empty state, not a fake number.
    return { doorsTarget: 0, presentationsTarget: 0, soldTarget: 0, usedStarter: true };
  }

  // Use the rep's own ratios only when they've qualified AND both are usable; otherwise the starter.
  const ownRatios = input.qualified && usable(input.closeRatio) && usable(input.contactRatio);
  const close = ownRatios ? (input.closeRatio as number) : STARTER_CLOSE_RATIO;
  const contact = ownRatios ? (input.contactRatio as number) : STARTER_CONTACT_RATIO;

  const presentationsTarget = ceilPos(soldTarget / close);
  const rawDoors = ceilPos(presentationsTarget / contact);
  const doorsTarget = Math.min(DOORS_CEILING, Math.max(DOORS_FLOOR, rawDoors));

  return { doorsTarget, presentationsTarget, soldTarget, usedStarter: !ownRatios };
}

/**
 * Ring fill for a dial (03-number-logic.md #8): fraction of target reached, CLAMPED at 1 so overshoot fills
 * the ring and stops (95 of 80 → full ring, no second lap). A zero/absent target yields 0 (empty ring).
 */
export function dialFill(count: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.min(1, Math.max(0, count / target));
}
