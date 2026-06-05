/**
 * Living Diagnosis — type definitions.
 *
 * The diagnosis engine implements §1 ("Living Diagnosis") as runtime code.
 * Every type here is a structural representation of a step in the loop. The names
 * mirror the constitution intentionally — if a section is renamed, the
 * corresponding type/function here is renamed in the same amendment.
 */

export type SignalRef = {
  id: string;
  kind: string;
  source: string;
  observed_at: string;
  payload?: Record<string, unknown>;
};

export type EventRef = {
  id: string;
  kind: string;
  subject: string;
  occurred_at: string;
  payload?: Record<string, unknown>;
};

/** A pattern found by retrospective identification (§1.2). */
export type RetrospectivePattern = {
  description: string;
  recurringSubjects: string[];
  signalIds: string[];
  earliestObserved: string;
  latestObserved: string;
  occurrences: number;
  // Distinct sources matter for the Understanding Gate (§3.2) — we surface this so the
  // gate's source-diversity threshold can be evaluated structurally.
  distinctSources: string[];
};

/** An alternative reading of the same data produced by outside-view (§1.3). */
export type OutsideViewReading = {
  framing: string;       // how someone with no stake would describe it
  whatItChallenges: string; // which assumption in the current read it questions
  ifTrueThen: string;    // what would need to be different if this read were correct
};

/** Result of evaluating the Understanding Gate (§3.2) for a problem hypothesis. */
export type GateEvaluation = {
  passes: boolean;
  reason: string;
  signalCount: number;
  distinctSourceCount: number;
  diagnosisCharCount: number;
  threshold: {
    minSignals: number;
    minDistinctSources: number;
    minDiagnosisChars: number;
  };
};

/** A ripple-effect prediction from the holistic step (§1.5, §2). */
export type RippleEffect = {
  affectedSubject: string; // e.g. 'task:abc', 'team_member:xyz', 'process:onboarding'
  effect: string;          // what happens to it
  confidence: "high" | "medium" | "low";
  reasoning: string;       // why we think so — Rule 2
};

/** A candidate resolution: an action with explicit WHY and predicted ripples. */
export type CandidateResolution = {
  action: string;
  reasoning: string;
  expectedOutcome: string;
  predictedRipples: RippleEffect[];
};

/** The full Living Diagnosis record for a single run through the loop. */
export type DiagnosisRun = {
  id: string;
  startedAt: string;
  situation: string;
  retrospective: RetrospectivePattern[];
  outsideViews: OutsideViewReading[];
  problemHypothesis: {
    kind: string;
    title: string;
    diagnosis: string; // the earned WHY
  } | null;
  gate: GateEvaluation | null;
  candidates: CandidateResolution[];
  chosen?: CandidateResolution;
  resolutionId?: string;
  closedAt?: string;
};

export type DiagnosisStep =
  | "data"           // §1.1 — assemble what's in the record
  | "retrospective"  // §1.2
  | "outsideView"    // §1.3
  | "gate"           // §3.2 — Understanding Gate evaluation
  | "rippleTrace"    // §1.5 — holistic effects
  | "decide"         // human-in-the-loop choice
  | "close";         // §1.6 — close the loop

export const DIAGNOSIS_STEPS: DiagnosisStep[] = [
  "data",
  "retrospective",
  "outsideView",
  "gate",
  "rippleTrace",
  "decide",
  "close",
];
