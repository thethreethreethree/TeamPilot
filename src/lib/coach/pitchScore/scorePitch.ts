import {
  BONUSES_BY_ID,
  BONUS_CAP,
  ELEMENTS_BY_ID,
  GRADE_CREDIT,
  OBJECTION_ELEMENT_ID,
  QUALIFYING_MIN_BASE,
  RUBRIC_VERSION,
  SECTIONS,
  VIOLATIONS_BY_ID,
  type Grade,
  type SectionId,
} from "./rubric";

/**
 * The Pitch Score calculation — Project 1 of the 2026-09-19 coaching build.
 *
 * Pure. Takes graded elements and detected events, returns a score. It does no AI work, no I/O and
 * no persistence: the grading step decides WHAT happened, this decides what it is WORTH. Keeping
 * the arithmetic separate from the model call is what makes the launch gate possible at all —
 * "run 10 to 20 real recordings through the scorer and have a manager grade the same pitches by
 * hand" only means something if the same inputs always produce the same number.
 *
 * Formula, from the rubric: `total = max(0, base + min(bonus, 30) − violations)`
 *
 * Three details in that line are easy to get subtly wrong, so each is called out at its
 * implementation below: the cap is per pitch and applies before any averaging; violations subtract
 * AFTER bonus is added; and the floor wraps the whole expression rather than any one component.
 */

export type GradedElement = {
  elementId: string;
  grade: Grade;
  /** Seconds into the recording — powers the play button that jumps to the moment. */
  timestampS?: number;
  /** Short quote or note explaining the grade, required by the rubric's per-element output rule. */
  evidence?: string;
};

export type DetectedBonus = {
  bonusId: string;
  timestampS?: number;
  evidence?: string;
  /** 0..1 for audio-inferred bonuses. Absent means not audio-inferred. */
  confidence?: number;
};

export type DetectedViolation = {
  violationId: string;
  timestampS?: number;
  evidence?: string;
};

export type ScorePitchInput = {
  elements: readonly GradedElement[];
  bonuses?: readonly DetectedBonus[];
  violations?: readonly DetectedViolation[];
  /**
   * Whether the customer raised an objection. When false the Objection handling skill is not
   * scored and the other five Delivery skills are scaled up — see the scaling block below.
   */
  objectionOccurred: boolean;
  /** Whether the pitch got as far as the Discovery phase. Half of the qualifying test. */
  reachedDiscovery: boolean;
  /**
   * Confidence floor for audio-inferred bonuses. Defaults to the rubric's starting value; exposed
   * so the founder can tune it after testing without touching this file (guide open decision #4).
   */
  audioConfidenceThreshold?: number;
};

export type ScoredBonus = { bonusId: string; points: number; capped: boolean };
export type ScoredViolation = { violationId: string; deduction: number; capped: boolean };

/**
 * An element that actually counted, with what it was worth.
 *
 * Exists so no caller has to work out for itself which grades the scorer honoured. Three rules
 * decide that — unknown ids are dropped, duplicates keep the first grade, and Objection handling
 * is skipped entirely when no objection occurred — and a caller re-applying them is the §2.2
 * duplicated-condition shape. The persistence layer in particular would otherwise store an
 * "Objection handling: missed" row against a pitch where the customer never objected, which is
 * the false accusation the rubric is explicit must not happen.
 *
 * `points` is the RAW rubric-weight value, before any Delivery scaling — `sectionPoints` carries
 * the scaled figure. So a 3-point element graded partial reads 1.5 here and always will.
 */
export type ScoredElement = {
  elementId: string;
  grade: Grade;
  section: SectionId;
  points: number;
};

export type PitchScore = {
  rubricVersion: string;
  /** 0..100, the sum of the six section totals. */
  base: number;
  /** Already capped at 30. */
  bonus: number;
  /** Positive magnitude of everything deducted. */
  violations: number;
  /** max(0, base + bonus − violations). */
  total: number;
  sectionPoints: Record<SectionId, number>;
  /** Every element that counted, in the order graded. The authority on what was scored. */
  elementBreakdown: ScoredElement[];
  bonusBreakdown: ScoredBonus[];
  violationBreakdown: ScoredViolation[];
  /** True when the pitch counts toward the leaderboard. */
  qualifying: boolean;
  /** Why it does not count. Null when it does. The guide requires storing this. */
  notQualifyingReason: string | null;
  /** True when Delivery was scaled because no objection occurred. */
  deliveryScaled: boolean;
  /** Bonuses dropped for failing the confidence floor — surfaced so a dispute can be answered. */
  rejectedLowConfidence: string[];
};

/** Money-style rounding to one decimal, matching how every mockup displays scores. */
const r1 = (n: number) => Math.round(n * 10) / 10;

export function scorePitch(input: ScorePitchInput): PitchScore {
  const threshold = input.audioConfidenceThreshold ?? 0.8;

  // ── Base ────────────────────────────────────────────────────────────────────────────────────
  const sectionPoints = Object.fromEntries(
    SECTIONS.map((s) => [s.id, 0])
  ) as Record<SectionId, number>;

  let deliveryEarnedExObjection = 0;
  let deliveryMaxExObjection = 0;
  const elementBreakdown: ScoredElement[] = [];
  const seenElements = new Set<string>();

  for (const graded of input.elements) {
    const def = ELEMENTS_BY_ID.get(graded.elementId);
    // An unknown element id is dropped rather than thrown on: a rubric version bump can retire an
    // element, and a stored grade referencing it must not make an old pitch unscoreable.
    if (!def) continue;

    // When no objection occurred, Objection handling is not scored at all — the rubric is explicit
    // that "avoiding objections earns no free points", so it cannot simply be credited.
    if (!input.objectionOccurred && def.id === OBJECTION_ELEMENT_ID) continue;

    // First grade wins for a repeated element. A model that lists the same element twice — which
    // happens, because it is asked for thirty of them in one answer — would otherwise have its
    // points counted twice into base and into the section total, inflating a real rep's score for
    // a formatting slip. It is also unstorable: pitch_elements is unique on (pitch_id, element_id),
    // so the whole write would fail at the last step with the score already computed.
    if (seenElements.has(def.id)) continue;
    seenElements.add(def.id);

    const earned = def.points * GRADE_CREDIT[graded.grade];
    sectionPoints[def.section] += earned;
    elementBreakdown.push({
      elementId: def.id,
      grade: graded.grade,
      section: def.section,
      points: r1(earned),
    });

    if (def.section === "delivery" && def.id !== OBJECTION_ELEMENT_ID) {
      deliveryEarnedExObjection += earned;
      deliveryMaxExObjection += def.points;
    }
  }

  // Delivery scaling. "If no objection occurs, the other delivery skills are scored out of 27 and
  // scaled to 35. A smooth pitch is not penalized, and avoiding objections earns no free points."
  //
  // The SCALED figure is what gets stored, not the raw 27-max one, because the launch gate requires
  // section totals to sum to base — an unscaled Delivery would break that identity on every
  // objection-free pitch and the reconciliation shown on the Breakdown screen would not add up.
  let deliveryScaled = false;
  if (!input.objectionOccurred && deliveryMaxExObjection > 0) {
    const deliveryMax = SECTIONS.find((s) => s.id === "delivery")!.maxPoints;
    sectionPoints.delivery = (deliveryEarnedExObjection / deliveryMaxExObjection) * deliveryMax;
    deliveryScaled = true;
  }

  for (const s of SECTIONS) sectionPoints[s.id] = r1(sectionPoints[s.id]);
  const base = r1(SECTIONS.reduce((sum, s) => sum + sectionPoints[s.id], 0));

  // ── Bonus ───────────────────────────────────────────────────────────────────────────────────
  // Repeatable bonuses accumulate to their own ceiling first (buying questions, +2 each to +6),
  // then the whole bonus pool is capped at 30. Two ceilings, applied in that order.
  const perBonusTotals = new Map<string, number>();
  const rejectedLowConfidence: string[] = [];

  for (const detected of input.bonuses ?? []) {
    const def = BONUSES_BY_ID.get(detected.bonusId);
    if (!def) continue;

    // Audio-inferred bonuses need a confidence floor. The rubric: "Award the bonus only above a
    // confidence threshold, and let managers override when a rep disputes a result." A rejected
    // one is recorded rather than dropped silently, so the dispute has something to point at.
    if (def.audioInferred && (detected.confidence ?? 0) < threshold) {
      rejectedLowConfidence.push(def.id);
      continue;
    }

    const already = perBonusTotals.get(def.id) ?? 0;
    if (!def.repeatable && already > 0) continue; // once per pitch

    const ceiling = def.maxTotal ?? def.points;
    perBonusTotals.set(def.id, Math.min(already + def.points, ceiling));
  }

  const bonusRaw = [...perBonusTotals.values()].reduce((a, b) => a + b, 0);
  // The cap is PER PITCH and applied here, before the value is ever stored or averaged. Averaging
  // uncapped values and capping the mean would quietly inflate a rep who has one huge pitch.
  const bonus = r1(Math.min(bonusRaw, BONUS_CAP));

  const bonusBreakdown: ScoredBonus[] = [...perBonusTotals.entries()].map(([bonusId, points]) => ({
    bonusId,
    points: r1(points),
    capped: (BONUSES_BY_ID.get(bonusId)?.maxTotal ?? Infinity) <= points,
  }));

  // ── Violations ──────────────────────────────────────────────────────────────────────────────
  const perViolationTotals = new Map<string, number>();
  for (const detected of input.violations ?? []) {
    const def = VIOLATIONS_BY_ID.get(detected.violationId);
    if (!def) continue;
    const already = perViolationTotals.get(def.id) ?? 0;
    if (!def.repeatable && already > 0) continue;
    const ceiling = def.maxTotal ?? Infinity;
    perViolationTotals.set(def.id, Math.min(already + def.deduction, ceiling));
  }

  // Uncapped in total — only individual violations have ceilings.
  const violations = r1([...perViolationTotals.values()].reduce((a, b) => a + b, 0));

  const violationBreakdown: ScoredViolation[] = [...perViolationTotals.entries()].map(
    ([violationId, deduction]) => ({
      violationId,
      deduction: r1(deduction),
      capped: (VIOLATIONS_BY_ID.get(violationId)?.maxTotal ?? Infinity) <= deduction,
    })
  );

  // ── Total ───────────────────────────────────────────────────────────────────────────────────
  // Violations subtract AFTER bonus is added, and the floor wraps the whole expression — a pitch
  // with heavy deductions bottoms out at 0 rather than going negative on the leaderboard.
  const total = r1(Math.max(0, base + bonus - violations));

  // ── Qualification ───────────────────────────────────────────────────────────────────────────
  // Judged on BASE, never on total. A pitch can show a healthy total off the back of bonuses and
  // still not qualify, which is why the reason is stored and surfaced rather than left for the
  // reader to infer from a number that does not explain itself.
  let notQualifyingReason: string | null = null;
  if (!input.reachedDiscovery) {
    notQualifyingReason = "Didn't reach Discovery";
  } else if (base < QUALIFYING_MIN_BASE) {
    notQualifyingReason = `Scored under ${QUALIFYING_MIN_BASE} base`;
  }

  return {
    rubricVersion: RUBRIC_VERSION,
    base,
    bonus,
    violations,
    total,
    sectionPoints,
    elementBreakdown,
    bonusBreakdown,
    violationBreakdown,
    qualifying: notQualifyingReason === null,
    notQualifyingReason,
    deliveryScaled,
    rejectedLowConfidence,
  };
}
