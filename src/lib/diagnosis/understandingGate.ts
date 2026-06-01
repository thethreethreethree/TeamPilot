/**
 * Understanding Gate — client-side evaluator (CLAUDE.md §3.2).
 *
 * The authoritative gate is the DB trigger in migration 0002. This is a *mirror*
 * the application uses to predict, BEFORE attempting to surface, whether the gate
 * would pass — so the UI can show "you need N more signals" instead of inviting
 * the user to try and fail.
 *
 * Truth-source rule: if this mirror and the trigger ever disagree, the trigger
 * wins. The mirror is hint, not law. (Rule 2: locked doors are real constraints.)
 */

import type { GateEvaluation } from "./types";

export const DEFAULT_THRESHOLD = {
  minSignals: 3,
  minDistinctSources: 2,
  minDiagnosisChars: 80,
};

export function evaluateUnderstandingGate(args: {
  signalCount: number;
  distinctSources: string[];
  diagnosis: string;
  threshold?: Partial<typeof DEFAULT_THRESHOLD>;
}): GateEvaluation {
  const threshold = { ...DEFAULT_THRESHOLD, ...args.threshold };
  const signalCount = args.signalCount;
  const distinctSourceCount = new Set(args.distinctSources).size;
  const diagnosisCharCount = (args.diagnosis ?? "").trim().length;

  const failures: string[] = [];
  if (signalCount < threshold.minSignals) {
    failures.push(
      `needs ≥${threshold.minSignals} signals, has ${signalCount}`
    );
  }
  if (distinctSourceCount < threshold.minDistinctSources) {
    failures.push(
      `needs ≥${threshold.minDistinctSources} distinct sources, has ${distinctSourceCount}`
    );
  }
  if (diagnosisCharCount < threshold.minDiagnosisChars) {
    failures.push(
      `needs ≥${threshold.minDiagnosisChars} chars of diagnosis (the WHY), has ${diagnosisCharCount}`
    );
  }

  return {
    passes: failures.length === 0,
    reason:
      failures.length === 0
        ? "Gate passes — sufficient evidence + stated diagnosis."
        : `Gate holds — ${failures.join("; ")}.`,
    signalCount,
    distinctSourceCount,
    diagnosisCharCount,
    threshold,
  };
}

export function describeGapToGate(eval_: GateEvaluation): string {
  if (eval_.passes) return "";
  const gaps: string[] = [];
  if (eval_.signalCount < eval_.threshold.minSignals) {
    gaps.push(
      `${eval_.threshold.minSignals - eval_.signalCount} more signal${
        eval_.threshold.minSignals - eval_.signalCount === 1 ? "" : "s"
      } needed`
    );
  }
  if (eval_.distinctSourceCount < eval_.threshold.minDistinctSources) {
    gaps.push(
      `${
        eval_.threshold.minDistinctSources - eval_.distinctSourceCount
      } more distinct source${
        eval_.threshold.minDistinctSources - eval_.distinctSourceCount === 1
          ? ""
          : "s"
      } needed`
    );
  }
  if (eval_.diagnosisCharCount < eval_.threshold.minDiagnosisChars) {
    gaps.push(
      `${
        eval_.threshold.minDiagnosisChars - eval_.diagnosisCharCount
      } more chars of stated WHY`
    );
  }
  return gaps.join("; ");
}
