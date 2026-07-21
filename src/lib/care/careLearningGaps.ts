/**
 * C.A.R.E learning-gap derivation — the "which communication-book principle needs reinforcement"
 * mapping (founder 2026-07-22). Pure logic, split out from careCoachAssessment.ts so it's testable
 * without pulling in the Supabase server client.
 *
 * From an agent's count aggregate: flag the weakest positive signal (if genuinely below a competent bar)
 * and the most-frequent risk (if any), each mapped to a named principle from docs/COACH_KNOWLEDGE_BASE.md.
 * Worst-first, at most two — so a manager coaches the one thing that matters next, not a wall of critique.
 */

import type { CareCoachAggregate } from "@/lib/care/careQualityGrade";

export type LearningGap = {
  skill: string;
  principle: string;
  book: string;
};

const POSITIVE_GAP: Record<"acknowledged" | "answered" | "next_step", LearningGap> = {
  acknowledged: {
    skill: "Acknowledging the customer's concern before solving",
    principle: "Tactical empathy — label the feeling",
    book: "Never Split the Difference",
  },
  answered: {
    skill: "Answering the actual question directly",
    principle: "Say the thing plainly; don't bury the answer",
    book: "On Writing Well",
  },
  next_step: {
    skill: "Offering a clear next step",
    principle: "Commitment & consistency — end with the ask",
    book: "Influence",
  },
};

const RISK_GAP: Record<"unsupportedAbsolutes" | "fabricatedSpecifics" | "emptyFiller", LearningGap> = {
  unsupportedAbsolutes: {
    skill: "Avoiding overpromises and absolutes",
    principle: "Make it safe — stay honest about what's certain",
    book: "Crucial Conversations",
  },
  fabricatedSpecifics: {
    skill: "Not inventing specifics to sound confident",
    principle: "Accuracy over fluency — concrete but true",
    book: "Made to Stick",
  },
  emptyFiller: {
    skill: "Cutting empty filler",
    principle: "Every word must earn its place",
    book: "On Writing Well",
  },
};

/** The competent bar: a positive signal present on fewer than this share of replies is a coaching target. */
export const POSITIVE_GAP_THRESHOLD = 0.6;

/**
 * Up to two book-grounded coaching targets, worst-first: the weakest positive signal (only if under the
 * competent bar) then the most-frequent risk (only if it actually occurs). Empty when the agent is solid
 * or has no graded replies.
 */
export function deriveLearningGaps(agg: CareCoachAggregate): LearningGap[] {
  const gaps: LearningGap[] = [];
  const n = agg.repliesGraded;
  if (n <= 0) return gaps;

  const positives: Array<[keyof typeof POSITIVE_GAP, number]> = [
    ["acknowledged", agg.acknowledgedCount / n],
    ["answered", agg.answeredCount / n],
    ["next_step", agg.nextStepCount / n],
  ];
  positives.sort((a, b) => a[1] - b[1]);
  const weakest = positives[0];
  if (weakest && weakest[1] < POSITIVE_GAP_THRESHOLD) gaps.push(POSITIVE_GAP[weakest[0]]);

  const risks: Array<[keyof typeof RISK_GAP, number]> = [
    ["unsupportedAbsolutes", agg.risks.unsupportedAbsolutes],
    ["fabricatedSpecifics", agg.risks.fabricatedSpecifics],
    ["emptyFiller", agg.risks.emptyFiller],
  ];
  risks.sort((a, b) => b[1] - a[1]);
  const worstRisk = risks[0];
  if (worstRisk && worstRisk[1] > 0) gaps.push(RISK_GAP[worstRisk[0]]);

  return gaps.slice(0, 2);
}
