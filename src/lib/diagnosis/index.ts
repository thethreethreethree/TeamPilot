/**
 * Living Diagnosis — runtime orchestrator (CLAUDE.md §1).
 *
 * This file is the engine that walks the executive through the diagnostic loop
 * over their own data. It composes the per-step modules into a sequence:
 *
 *   data → retrospective → outsideView → gate → rippleTrace → decide → close
 *
 * Each step has a *next-step decision* baked in: the orchestrator does not blindly
 * advance — it asks "is this step's output sufficient to proceed?" and refuses to
 * advance when the answer is no. This is the constitution's discipline applied
 * to its own runtime: the engine distrusts its own state until evidence supports
 * advancement.
 */

// Public client-safe surface. Server-only modules (outsideView, rippleTrace) are
// NOT re-exported here — importing the diagnosis index from a client component
// would otherwise pull the Anthropic SDK into the browser bundle (it refuses to
// run there). Server callers import those directly:
//   import { generateOutsideViews } from "@/lib/diagnosis/outsideView";
//   import { traceRipples }        from "@/lib/diagnosis/rippleTrace";

export * from "./types";
export { deriveRetrospectivePatterns } from "./retrospective";
export {
  evaluateUnderstandingGate,
  describeGapToGate,
  DEFAULT_THRESHOLD,
} from "./understandingGate";
export { closeProblemLoop } from "./closeLoop";

import type {
  DiagnosisStep,
  DiagnosisRun,
  GateEvaluation,
  RetrospectivePattern,
} from "./types";

/**
 * Given a diagnosis run's current state, decide whether the engine is allowed to
 * advance to the next step. Returns the *reason* the engine holds when it does —
 * a held step is informational, not a failure.
 */
export function canAdvance(
  run: DiagnosisRun,
  step: DiagnosisStep
): { ok: boolean; reason: string } {
  switch (step) {
    case "data":
      return { ok: true, reason: "Data is the entry point." };
    case "retrospective":
      // Can run once data is assembled. No prerequisite — the engine will simply
      // find zero patterns if there's no record.
      return { ok: true, reason: "Always runnable; output may be empty." };
    case "outsideView":
      // Outside view requires *some* current read to challenge. With zero
      // retrospective patterns AND no user-stated hypothesis, there is nothing
      // to challenge.
      if (run.retrospective.length === 0 && !run.problemHypothesis) {
        return {
          ok: false,
          reason:
            "No retrospective patterns or stated hypothesis yet — there is nothing for an outside view to challenge. Hold the step.",
        };
      }
      return { ok: true, reason: "There is a framing to challenge." };
    case "gate":
      // The gate evaluates a *hypothesis*. Without a stated hypothesis there is
      // nothing to gate. The engine refuses to evaluate an empty hypothesis as
      // "passing" by default — that would be the §3.2 violation we exist to
      // prevent.
      if (!run.problemHypothesis) {
        return {
          ok: false,
          reason:
            "No problem hypothesis stated yet. The gate evaluates a stated WHY; it cannot evaluate silence.",
        };
      }
      return { ok: true, reason: "Hypothesis present; gate can evaluate." };
    case "rippleTrace":
      // Ripple-trace operates on a candidate action. It is meaningful only when
      // the gate has *passed* — otherwise we'd be ripple-tracing a problem we
      // haven't earned the right to surface.
      if (!run.gate?.passes) {
        return {
          ok: false,
          reason:
            "Understanding Gate has not passed. Ripple-tracing an unearned problem would be motion without understanding.",
        };
      }
      return { ok: true, reason: "Gate passed; ripple-tracing is meaningful." };
    case "decide":
      if (run.candidates.length === 0) {
        return {
          ok: false,
          reason:
            "No candidate resolutions traced yet. The decision step needs at least one ripple-traced candidate to weigh.",
        };
      }
      return { ok: true, reason: "Candidates available; user can decide." };
    case "close":
      if (!run.chosen) {
        return {
          ok: false,
          reason:
            "No resolution chosen. Close-the-loop requires a committed choice (or an explicit 'defer').",
        };
      }
      return { ok: true, reason: "Choice committed; loop can close." };
  }
}

/**
 * Convenience: given a set of patterns, build a human-readable evidence summary
 * that downstream Claude prompts can ingest. Kept here so the formatting is one
 * place; if the format changes, all prompts see the change at once.
 */
export function summarizeEvidence(patterns: RetrospectivePattern[]): string {
  if (patterns.length === 0) return "No patterns detected yet.";
  return patterns
    .map(
      (p, i) =>
        `${i + 1}. ${p.description} (occurrences: ${p.occurrences}, sources: ${p.distinctSources.length}, window: ${p.earliestObserved} → ${p.latestObserved})`
    )
    .join("\n");
}

/** Re-export GateEvaluation for callers that just want the type. */
export type { GateEvaluation };
