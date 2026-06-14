/**
 * §3.4 cycle phase resolver.
 *
 * Pure function — safe to call from server or client. Mirrors the
 * SQL function `company_cycle_phase` from migration 0031 exactly so
 * both layers compute the same phase from the same anchor.
 *
 * Cycle:
 *   - control (days 0-29 from anchor): Coach is LOCKED OFF.
 *     Captures an honest baseline of the team operating as
 *     themselves (§3.4). The DB trigger refuses coach_enabled = true
 *     during this window.
 *   - intervention (days 30-59): Coach CAN be turned on. This is
 *     the single-variable intervention period — the only thing that
 *     changed is the guidance layer.
 *   - ongoing (day 60+): post-checkpoint compounding period. Coach
 *     stays available; the §4 readout continues to accumulate
 *     data.
 *
 * Override:
 *   When cycle_control_skipped_at is set, the phase jumps to
 *   'intervention' immediately. This is the structural defense
 *   against §5's "builder under pressure" — the override is
 *   permitted but leaves a permanent on-the-record mark so the
 *   readout can flag the company as "skipped control."
 */

export type CompanyCyclePhase = "control" | "intervention" | "ongoing";

export type CyclePhaseDetails = {
  phase: CompanyCyclePhase;
  /** Days elapsed since cycle_started_at, floored. */
  daysIntoCycle: number;
  /** When does the current phase end? null when phase === 'ongoing'
   *  (no further transition). For control: the day 30 transition.
   *  For intervention: the day 60 transition. */
  phaseEndsAt: string | null;
  /** Days remaining in the current phase. 0 when in 'ongoing'. */
  daysRemainingInPhase: number;
  /** True when this company explicitly overrode the control window.
   *  The §4 readout flags these companies separately. */
  skippedControl: boolean;
  /** ISO timestamp of the override, if any. */
  skippedAt: string | null;
};

const CONTROL_DAYS = 30;
const INTERVENTION_DAYS = 60; // cumulative from anchor

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function resolveCyclePhase(args: {
  cycleStartedAt: string | Date;
  cycleControlSkippedAt?: string | Date | null;
  now?: Date;
}): CyclePhaseDetails {
  const now = args.now ?? new Date();
  const start = new Date(args.cycleStartedAt);
  const skipped = args.cycleControlSkippedAt
    ? new Date(args.cycleControlSkippedAt)
    : null;

  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY)
  );

  let phase: CompanyCyclePhase;
  if (skipped) {
    phase = elapsedDays < INTERVENTION_DAYS ? "intervention" : "ongoing";
  } else if (elapsedDays < CONTROL_DAYS) {
    phase = "control";
  } else if (elapsedDays < INTERVENTION_DAYS) {
    phase = "intervention";
  } else {
    phase = "ongoing";
  }

  let phaseEndsAt: string | null = null;
  let daysRemainingInPhase = 0;
  if (phase === "control") {
    const endsMs = start.getTime() + CONTROL_DAYS * MS_PER_DAY;
    phaseEndsAt = new Date(endsMs).toISOString();
    daysRemainingInPhase = Math.max(
      0,
      Math.ceil((endsMs - now.getTime()) / MS_PER_DAY)
    );
  } else if (phase === "intervention") {
    const endsMs = start.getTime() + INTERVENTION_DAYS * MS_PER_DAY;
    phaseEndsAt = new Date(endsMs).toISOString();
    daysRemainingInPhase = Math.max(
      0,
      Math.ceil((endsMs - now.getTime()) / MS_PER_DAY)
    );
  }

  return {
    phase,
    daysIntoCycle: elapsedDays,
    phaseEndsAt,
    daysRemainingInPhase,
    skippedControl: !!skipped,
    skippedAt: skipped ? skipped.toISOString() : null,
  };
}

/**
 * Convenience: true when coach_enabled CAN be flipped to true given
 * the resolved phase. The DB trigger enforces this server-side; this
 * helper lets the UI disable the toggle without round-tripping.
 */
export function canEnableCoach(details: CyclePhaseDetails): boolean {
  return details.phase !== "control";
}

/**
 * Short human label for the phase. Used in banners and chips.
 */
export function phaseLabel(phase: CompanyCyclePhase): string {
  switch (phase) {
    case "control":
      return "Month 1 — Control";
    case "intervention":
      return "Month 2 — Single-variable intervention";
    case "ongoing":
      return "Post-checkpoint — Compounding";
  }
}
