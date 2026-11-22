import {
  AUDIO_BONUS_CONFIDENCE_THRESHOLD,
  BASE_MAX,
  BONUSES,
  BONUS_CAP,
  ELEMENTS,
  OBJECTION_ELEMENT_ID,
  QUALIFYING_MIN_BASE,
  RUBRIC_VERSION,
  SECTIONS,
  VIOLATIONS,
  type RubricBonus,
  type RubricElement,
  type RubricSection,
  type RubricViolation,
} from "./rubric";
import { REMOTE_BONUSES, REMOTE_ELEMENTS, REMOTE_RUBRIC_VERSION } from "./rubricRemote";

/**
 * Which rubric scores a call (decision D6). One bundle per rubric, so the scorer, the prompt and the stored version
 * always come from the same rubric — never door elements with a remote version label.
 *
 * REMOTE_RUBRIC_APPROVED: the phone/video rubric (docs/rss/REMOTE-RUBRIC-DRAFT.md) was approved by the founder on
 * 2026-11-22 — phone and video calls scored from then on use it; door calls keep the door rubric. Its rubric_config row
 * (pitch_scores.rubric_version is a foreign key) is seeded by 0307. Past scores keep the rubric they were made under.
 */
// APPROVED 2026-11-22 by the founder (picker, "Approve as drafted"): new phone/video calls are scored with it.
export const REMOTE_RUBRIC_APPROVED = true;

export type Rubric = {
  version: string;
  label: string;
  sections: readonly RubricSection[];
  elements: readonly RubricElement[];
  bonuses: readonly RubricBonus[];
  violations: readonly RubricViolation[];
  baseMax: number;
  bonusCap: number;
  qualifyingMinBase: number;
  audioConfidenceThreshold: number;
  objectionElementId: string;
  elementsById: ReadonlyMap<string, RubricElement>;
  bonusesById: ReadonlyMap<string, RubricBonus>;
  violationsById: ReadonlyMap<string, RubricViolation>;
};

function bundle(version: string, label: string, elements: readonly RubricElement[], bonuses: readonly RubricBonus[]): Rubric {
  return {
    version,
    label,
    sections: SECTIONS,
    elements,
    bonuses,
    violations: VIOLATIONS,
    baseMax: BASE_MAX,
    bonusCap: BONUS_CAP,
    qualifyingMinBase: QUALIFYING_MIN_BASE,
    audioConfidenceThreshold: AUDIO_BONUS_CONFIDENCE_THRESHOLD,
    objectionElementId: OBJECTION_ELEMENT_ID,
    elementsById: new Map(elements.map((e) => [e.id, e])),
    bonusesById: new Map(bonuses.map((b) => [b.id, b])),
    violationsById: new Map(VIOLATIONS.map((v) => [v.id, v])),
  };
}

export const DOOR_RUBRIC: Rubric = bundle(RUBRIC_VERSION, "AT&T Fiber Pitch Scoring Rubric v1", ELEMENTS, BONUSES);
export const REMOTE_RUBRIC: Rubric = bundle(REMOTE_RUBRIC_VERSION, "AT&T Fiber Phone & Video Pitch Rubric v1", REMOTE_ELEMENTS, REMOTE_BONUSES);

/** The rubric for a call's channel. Phone/video get the remote rubric only once it is approved. */
export function rubricForChannel(context: string | null | undefined, approved: boolean = REMOTE_RUBRIC_APPROVED): Rubric {
  return approved && (context === "phone" || context === "video") ? REMOTE_RUBRIC : DOOR_RUBRIC;
}

/** A stored score's rubric, by the version it was made under (a remote score stays readable after approval). */
export function rubricByVersion(version: string | null | undefined): Rubric {
  return version === REMOTE_RUBRIC_VERSION ? REMOTE_RUBRIC : DOOR_RUBRIC;
}

/**
 * The rubric_config row the phone/video rubric needs (pitch_scores.rubric_version is a foreign key — 0268's lesson: a
 * scorer stamping a version with no row loses every score). Seeded INACTIVE by 0307 while D6 awaits approval; the
 * migration is generated from this function and a test asserts they match (§2.2).
 */
export function remoteRubricConfigRow() {
  return {
    version: REMOTE_RUBRIC.version,
    company_id: null,
    label: REMOTE_RUBRIC.label,
    elements: REMOTE_RUBRIC.elements,
    bonuses: REMOTE_RUBRIC.bonuses,
    violations: REMOTE_RUBRIC.violations,
    base_max: REMOTE_RUBRIC.baseMax,
    bonus_cap: REMOTE_RUBRIC.bonusCap,
    qualifying_min_base: REMOTE_RUBRIC.qualifyingMinBase,
    audio_confidence_threshold: REMOTE_RUBRIC.audioConfidenceThreshold,
    is_active: false,
  };
}

