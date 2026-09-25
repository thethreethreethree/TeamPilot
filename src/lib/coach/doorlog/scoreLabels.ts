/**
 * The door-pitch Score-Chart dimensions, in the order the founder specified, and their display labels.
 *
 * ONE copy. TodaysMetrics and PitchDetail both render these dimensions; PitchDetail used to print the raw
 * key ("Talk_listen") because only TodaysMetrics held the label map. Keys match the grader's schema
 * (analyze.ts:34), whose scores are 0-100.
 */
export const SCORE_ORDER = ["objection", "talk_listen", "questions", "tone", "close"] as const;

export const SCORE_LABEL: Record<string, string> = {
  objection: "Objection",
  talk_listen: "Talk / Listen",
  questions: "Questions",
  tone: "Tone",
  close: "Close",
};
