import type { CoachAnalysisResponse, CoachClassification } from "./types";

/**
 * Shared validator for a Coach v5 analysis response (the LLM returns JSON; we never trust its shape).
 *
 * Extracted so the in-app C.A.R.E ask-coach route AND the browser-extension coach endpoint validate
 * IDENTICALLY — §3.4 (the extension is the real tool, not a lookalike) + §A26 (one validator, not two copies
 * that drift). Returns the validated response, or null if the shape is invalid (the caller then 502s).
 */

const VALID_CLASSIFICATIONS = new Set<CoachClassification>([
  "correct",
  "unclear",
  "unproductive",
  "negative",
]);

export function validateCoachAnalysis(parsed: unknown): CoachAnalysisResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (
    typeof r.classification !== "string" ||
    !VALID_CLASSIFICATIONS.has(r.classification as CoachClassification)
  ) {
    return null;
  }
  if (typeof r.needsImprovement !== "boolean") return null;
  if (!Array.isArray(r.conversationStarters)) return null;
  const starters: string[] = [];
  for (const s of r.conversationStarters) {
    if (typeof s === "string" && s.length > 0 && s.length <= 200) {
      starters.push(s);
    }
  }
  const response: CoachAnalysisResponse = {
    classification: r.classification as CoachClassification,
    needsImprovement: r.needsImprovement,
    conversationStarters: starters.slice(0, 3),
  };
  if (typeof r.affirmation === "string" && r.affirmation.length <= 600) {
    response.affirmation = r.affirmation;
  }
  if (r.needsImprovement) {
    const imp = r.improvement;
    if (typeof imp !== "object" || imp === null) return null;
    const i = imp as Record<string, unknown>;
    if (
      typeof i.suggestedRevision !== "string" ||
      i.suggestedRevision.length === 0 ||
      i.suggestedRevision.length > 4000 ||
      typeof i.whyContext !== "string" ||
      i.whyContext.length === 0 ||
      i.whyContext.length > 800 ||
      typeof i.whySentence !== "string" ||
      i.whySentence.length === 0 ||
      i.whySentence.length > 800
    ) {
      return null;
    }
    const principle = i.principleCited;
    if (typeof principle !== "object" || principle === null) return null;
    const p = principle as Record<string, unknown>;
    if (
      typeof p.name !== "string" ||
      typeof p.book !== "string" ||
      typeof p.sectionRef !== "string"
    ) {
      return null;
    }
    response.improvement = {
      suggestedRevision: i.suggestedRevision,
      whyContext: i.whyContext,
      whySentence: i.whySentence,
      principleCited: {
        name: p.name,
        book: p.book,
        sectionRef: p.sectionRef,
      },
    };
    if (typeof i.secondaryPrinciple === "object" && i.secondaryPrinciple !== null) {
      const sp = i.secondaryPrinciple as Record<string, unknown>;
      if (
        typeof sp.name === "string" &&
        typeof sp.book === "string" &&
        typeof sp.sectionRef === "string"
      ) {
        response.improvement.secondaryPrinciple = {
          name: sp.name,
          book: sp.book,
          sectionRef: sp.sectionRef,
        };
      }
    }
  }
  return response;
}
