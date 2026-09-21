/**
 * The AT&T Fiber Pitch Scoring Rubric, v1 — Project 1 of the 2026-09-19 coaching build.
 *
 * Source: docs/SYSTEM UPDATES AND REVISION/EloState AT&T Fiber Pitch Scoring Rubric.pdf (7 pp),
 * transcribed element by element. Every point value here was read off that document, and the
 * structural sums are asserted in __tests__/rubric.test.ts rather than trusted.
 *
 * WHY THIS FILE IS DATA AND NOT LOGIC. Three separate consumers read it: the scorer, the read-only
 * "Scoring rubric" screen the guide requires be "rendered from rubric_config so it never goes
 * stale", and Pattern Interrupt (which opens a pattern against a rubric ELEMENT and needs its
 * label, section and "what the pitch calls for" text). If the rubric lived in the scorer, the other
 * two would each grow their own copy and drift — the exact §2.2 duplicated-decision failure.
 *
 * WHY IT IS VERSIONED. A pitch scored in September must stay explainable in December even after the
 * rubric changes. `pitches.rubric_version` pins the config a score was computed under; nothing here
 * may be edited in place once scores reference it. A change means a NEW version.
 */

export const RUBRIC_VERSION = "attfiber-v1" as const;

export type SectionId =
  | "introduction"
  | "discovery"
  | "consulting"
  | "close"
  | "transitions"
  | "delivery";

export type Grade = "hit" | "partial" | "missed";

/** Credit multiplier per grade. Partial is explicitly "half points" in the rubric. */
export const GRADE_CREDIT: Record<Grade, number> = {
  hit: 1,
  partial: 0.5,
  missed: 0,
};

export type RubricElement = {
  id: string;
  section: SectionId;
  label: string;
  points: number;
  /** The rubric's "point that needs to land" — shown as evidence context and in Pattern Interrupt. */
  whatCounts: string;
};

export type RubricSection = {
  id: SectionId;
  label: string;
  maxPoints: number;
};

export type RubricBonus = {
  id: string;
  label: string;
  points: number;
  /** Awarded more than once per pitch, up to `maxTotal`. Only buying questions behave this way. */
  repeatable?: boolean;
  maxTotal?: number;
  /**
   * Inferred from ambient audio rather than the words, so it needs a confidence threshold before
   * it is awarded. The rubric says so for inside/backyard and laughter, and the guide's open
   * decision #4 sets the starting threshold at 0.8 pending testing.
   */
  audioInferred?: boolean;
  detectionNotes: string;
};

export type RubricViolation = {
  id: string;
  label: string;
  /** Positive magnitude. Subtraction happens in the scorer, so nothing here carries a sign. */
  deduction: number;
  repeatable?: boolean;
  /** Cap on the total deduction for this violation within one pitch. */
  maxTotal?: number;
  /** Escalates to a human: the rubric says a rude flag is "flagged for manager review". */
  flagsForReview?: boolean;
  trigger: string;
};

// ── Sections ──────────────────────────────────────────────────────────────────────────────────
// "Six categories add up to 100: Introduction 12, Discovery 16, Consulting 14, Close 15,
// Transitions 8, Delivery 35."
export const SECTIONS: readonly RubricSection[] = [
  { id: "introduction", label: "Introduction", maxPoints: 12 },
  { id: "discovery", label: "Discovery", maxPoints: 16 },
  { id: "consulting", label: "Consulting", maxPoints: 14 },
  { id: "close", label: "Close", maxPoints: 15 },
  { id: "transitions", label: "Transitions", maxPoints: 8 },
  { id: "delivery", label: "Delivery", maxPoints: 35 },
] as const;

export const BASE_MAX = 100;
export const BONUS_CAP = 30;
/** Max achievable: 100 + 30 − 0. The rubric screen states "100 + 30 − Viol. = 130 Max score". */
export const MAX_SCORE = BASE_MAX + BONUS_CAP;

// ── Elements ──────────────────────────────────────────────────────────────────────────────────
export const ELEMENTS: readonly RubricElement[] = [
  // Introduction — 12
  { id: "intro.trucks", section: "introduction", label: "Trucks / neighborhood notice", points: 3, whatCounts: "Crews will be working in the neighborhood" },
  { id: "intro.who", section: "introduction", label: "Who and what", points: 3, whatCounts: "AT&T Fiber, connecting the neighbors" },
  { id: "intro.done", section: "introduction", label: "What we've done", points: 3, whatCounts: "Old lines out, new fiber in" },
  { id: "intro.why", section: "introduction", label: "Why we're here", points: 3, whatCounts: "Neighbors unhappy with price and/or speed" },

  // Discovery — 16
  { id: "disc.usage", section: "discovery", label: "Internet usage", points: 4, whatCounts: "Asked, with a follow-up on the answer" },
  { id: "disc.currentSpeeds", section: "discovery", label: "Current speeds", points: 2, whatCounts: "Asked before the speed test" },
  { id: "disc.speedTest", section: "discovery", label: "Speed test", points: 4, whatCounts: "Run live; calling the number before it appears is required for the full 4" },
  { id: "disc.currentBill", section: "discovery", label: "Current bill", points: 3, whatCounts: "Got a dollar figure" },
  { id: "disc.painAmplifier", section: "discovery", label: "Pain amplifier", points: 3, whatCounts: "Made the customer feel the cost over time" },

  // Consulting — 14
  { id: "cons.sharedVsDedicated", section: "consulting", label: "Shared vs. dedicated", points: 4, whatCounts: "Why current service slows down and fiber does not" },
  { id: "cons.hotButtons", section: "consulting", label: "Hot buttons", points: 4, whatCounts: "Pitch tied back to the customer's usage answers" },
  { id: "cons.checklistSpeed", section: "consulting", label: "Checklist: speed", points: 2, whatCounts: "Current speed vs. fiber speed" },
  { id: "cons.checklistPrice", section: "consulting", label: "Checklist: price", points: 2, whatCounts: "Current bill vs. new price" },
  { id: "cons.checklistEquipment", section: "consulting", label: "Checklist: equipment", points: 1, whatCounts: "Equipment included" },
  { id: "cons.checklistInstall", section: "consulting", label: "Checklist: install", points: 1, whatCounts: "Install fee waived" },

  // Close — 15
  { id: "close.qualification", section: "close", label: "Catch: qualification", points: 3, whatCounts: "Credit check framed; customer confirms they pay on time" },
  { id: "close.deposit", section: "close", label: "Catch: deposit", points: 3, whatCounts: "Deposit framed as going toward the first bill" },
  { id: "close.simple", section: "close", label: "Simple close", points: 3, whatCounts: "Reserving the tech slot, with demand urgency" },
  { id: "close.options", section: "close", label: "Options close", points: 3, whatCounts: "Morning vs. afternoon choice" },
  { id: "close.paperwork", section: "close", label: "Into paperwork", points: 3, whatCounts: "Moves straight to qualifying without hesitation" },

  // Transitions — 8. "A hard, awkward jump between phases earns partial credit. No transition earns 0."
  { id: "trans.introToDiscovery", section: "transitions", label: "Intro to Discovery", points: 2, whatCounts: "A bridge such as \"let's see if this even makes sense\"" },
  { id: "trans.discoveryToConsulting", section: "transitions", label: "Discovery to Consulting", points: 2, whatCounts: "Pivot from the customer's numbers into the explanation" },
  { id: "trans.consultingToClose", section: "transitions", label: "Consulting to Close", points: 2, whatCounts: "Checklist tie-down into the catches" },
  { id: "trans.closeToQualify", section: "transitions", label: "Close to Qualify", points: 2, whatCounts: "Time slot locked, then straight into customer info" },

  // Delivery — 35
  { id: "deliv.objectionHandling", section: "delivery", label: "Objection handling", points: 8, whatCounts: "Acknowledge, isolate, answer, return to the close" },
  { id: "deliv.talkListen", section: "delivery", label: "Talk / listen balance", points: 7, whatCounts: "Customer gets real airtime" },
  { id: "deliv.tone", section: "delivery", label: "Tone and certainty", points: 7, whatCounts: "Confident and conversational; no drop-off when thrown a curveball" },
  { id: "deliv.questionQuality", section: "delivery", label: "Question quality", points: 5, whatCounts: "Open questions and follow-ups beyond the scripted three" },
  { id: "deliv.spokenYes", section: "delivery", label: "Spoken \"yes\" at hinge moments", points: 4, whatCounts: "Pauses for agreement instead of rolling through" },
  { id: "deliv.pace", section: "delivery", label: "Pace", points: 4, whatCounts: "Not rushed, no dead air" },
] as const;

/**
 * The one Delivery skill that is skipped when no objection occurs. The remaining five are scored
 * out of 27 and scaled to 35 — see scorePitch(). Named here rather than inlined so the scorer and
 * the tests cannot disagree about which element is excluded.
 */
export const OBJECTION_ELEMENT_ID = "deliv.objectionHandling";

// ── Bonuses — 13, capped at +30 per pitch ─────────────────────────────────────────────────────
// "All are detected by the AI from the recording; none come from rep self-reporting."
export const BONUSES: readonly RubricBonus[] = [
  { id: "bonus.inside", label: "Gets inside the house or backyard", points: 5, audioInferred: true, detectionNotes: "Inferred from audio. Counts whether the rep was invited or assumed their way in" },
  { id: "bonus.directv", label: "Pitches DIRECTV", points: 5, detectionNotes: "An actual pitch, not a passing mention" },
  { id: "bonus.wireless", label: "Pitches AT&T Wireless", points: 5, detectionNotes: "An actual pitch, not a passing mention" },
  { id: "bonus.adt", label: "Pitches ADT", points: 5, detectionNotes: "An actual pitch, not a passing mention" },
  { id: "bonus.referral", label: "Referral / next-door walk", points: 5, detectionNotes: "Customer names a neighbor or walks the rep over" },
  { id: "bonus.nonDecisionMakerSave", label: "Non-decision-maker save", points: 4, detectionNotes: "Firm return time plus something left behind for the decision maker" },
  { id: "bonus.icebreaker", label: "Icebreaker / tactical empathy", points: 3, detectionNotes: "Genuine personal connection before the pitch" },
  { id: "bonus.laughs", label: "Customer laughs", points: 3, audioInferred: true, detectionNotes: "Once per pitch" },
  { id: "bonus.pullsUpBill", label: "Customer pulls up their bill or account", points: 3, detectionNotes: "Customer opens their bill, app, or account during the pitch" },
  { id: "bonus.hardFollowUp", label: "Hard follow-up set", points: 3, detectionNotes: "Exact time, confirmed. \"Maybe like 6:00\" does not qualify" },
  { id: "bonus.neighborHook", label: "Neighbor hook with real names", points: 2, detectionNotes: "Specific neighbors or addresses, not \"your neighbors\"" },
  { id: "bonus.painOwnWords", label: "Customer states the pain in their own words", points: 2, detectionNotes: "Customer, not the rep, describes the problem" },
  { id: "bonus.buyingQuestions", label: "Buying questions", points: 2, repeatable: true, maxTotal: 6, detectionNotes: "e.g. \"When can you install?\", \"Is there a contract?\", \"What about my TV?\"" },
] as const;

/** Starting confidence threshold for audio-inferred bonuses (guide open decision #4: "start at 80%"). */
export const AUDIO_BONUS_CONFIDENCE_THRESHOLD = 0.8;

// ── Violations — 5, uncapped in total ─────────────────────────────────────────────────────────
// "Violations target bad pitching habits and are deducted AFTER base and bonus are added."
export const VIOLATIONS: readonly RubricViolation[] = [
  { id: "viol.rude", label: "Rude, dismissive, or condescending to the customer", deduction: 10, flagsForReview: true, trigger: "Any instance; flag for manager review" },
  { id: "viol.talkingTooMuch", label: "Talking too much", deduction: 5, trigger: "Rep talk share above ~75% for the full pitch, or a monologue over ~90 seconds with no customer input" },
  { id: "viol.notEnoughQuestions", label: "Not asking enough questions", deduction: 5, trigger: "Fewer than 3 discovery questions before the checklist" },
  { id: "viol.talkingOver", label: "Talking over the customer", deduction: 2, repeatable: true, maxTotal: 6, trigger: "Rep cuts in while the customer is mid-sentence" },
  { id: "viol.ignoringQuestion", label: "Ignoring a customer question", deduction: 2, repeatable: true, trigger: "Customer asks something and the rep moves on without answering" },
] as const;

// ── Qualification + competition ───────────────────────────────────────────────────────────────
/** "Counts toward the leaderboard only if it reached the Discovery phase and scored at least 40 base points." */
export const QUALIFYING_MIN_BASE = 40;
/** "Minimum of 5 qualifying pitches, matching the app's existing provisional threshold." */
export const PRIZE_ELIGIBLE_MIN_PITCHES = 5;

/**
 * Values the AI must never grade for ACCURACY, only for whether the point was made. Bills and promo
 * prices differ per household and change over time, so grading them would punish a rep for telling
 * the truth about a customer whose numbers differ from the script.
 */
export const NEVER_GRADE_FOR_ACCURACY = [
  "Customer bill and speed numbers (differ per household)",
  "Promo prices, speed tiers, and offers (change over time; script values are placeholders)",
  "Timeline claims such as when trucks arrive or when lines were run",
  "The customer's current provider (the rep adapts if it is not Xfinity)",
] as const;

// ── Lookups ───────────────────────────────────────────────────────────────────────────────────

export const ELEMENTS_BY_ID: ReadonlyMap<string, RubricElement> = new Map(
  ELEMENTS.map((e) => [e.id, e])
);
export const BONUSES_BY_ID: ReadonlyMap<string, RubricBonus> = new Map(
  BONUSES.map((b) => [b.id, b])
);
export const VIOLATIONS_BY_ID: ReadonlyMap<string, RubricViolation> = new Map(
  VIOLATIONS.map((v) => [v.id, v])
);

export function elementsForSection(section: SectionId): RubricElement[] {
  return ELEMENTS.filter((e) => e.section === section);
}

/**
 * Lowest-scoring section BY PERCENTAGE of its max, not by raw points.
 *
 * This is the rule the mockups use and the prose never states, and getting it wrong is invisible:
 * in the team averages Transitions (4.7) is the lowest ABSOLUTE score, yet Close (8.6) carries the
 * LOWEST badge — because 8.6/15 = 57.3% is below 4.7/8 = 58.8%. Sections are not comparable on raw
 * points when their maxima run from 8 to 35. Verified against three independent datasets in the
 * mockups (rep breakdown, team averages, Humza Khan's panel); see
 * docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md C1.
 */
export function lowestSection(
  sectionPoints: Readonly<Record<SectionId, number>>
): SectionId | null {
  let worst: SectionId | null = null;
  let worstRatio = Infinity;
  for (const s of SECTIONS) {
    const pts = sectionPoints[s.id];
    if (pts === undefined) continue;
    const ratio = pts / s.maxPoints;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worst = s.id;
    }
  }
  return worst;
}
