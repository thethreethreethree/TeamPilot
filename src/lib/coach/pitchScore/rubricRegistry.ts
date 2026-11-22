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
 * REMOTE_RUBRIC_APPROVED is OFF: the phone/video rubric is a draft (docs/rss/REMOTE-RUBRIC-DRAFT.md) under the
 * founder's review. While off, rubricForChannel returns the door rubric for every call — exactly today's behaviour.
 * Turning it on also needs its rubric_config row (pitch_scores.rubric_version is a foreign key) — see the draft doc.
 */
export const REMOTE_RUBRIC_APPROVED = false;

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
