/**
 * Per-company brain types. The brain accumulates §3.4 learning per company and
 * is composed into the system prompt for every LLM call routed to that company.
 *
 * All fields mirror migration 0007. If 0007 changes, this type must change too —
 * the SQL column types are the truth, this is the TS mirror.
 */

export type BrainPattern = {
  claim: string;
  source_event_ids: string[];
  source_resolution_ids?: string[];
  confidence: "high" | "medium" | "low";
  derived_from: "held_resolution" | "dismissed_problem" | "dialogue" | string;
  learned_at: string;
};

export type DisabledSuggestion = {
  suggestion: string;
  reason: string;
  source_event_ids?: string[];
  learned_at: string;
};

export type ValidatedMethod = {
  method: string;
  why: string;
  source_resolution_ids: string[];
  learned_at: string;
};

export type BrainRecord = {
  companyId: string;
  version: number;
  systemPromptAddendum: string;
  knownPatterns: BrainPattern[];
  styleCalibration: Record<string, unknown>;
  vocabulary: Record<string, unknown>;
  disabledSuggestions: DisabledSuggestion[];
  validatedMethods: ValidatedMethod[];
  lastLearningAt: string | null;
  lastLearningSummary: string | null;
  updatedAt: string;
};

export type ControlGate = {
  /** True when the §3.4 control window has expired or been manually unlocked. */
  guidanceEnabled: boolean;
  /** When AI guidance was enabled (manual or auto). */
  guidanceEnabledAt: string | null;
  /** When the auto-unlock fires (now + 30d from company creation, by default). */
  guidanceUnlockAt: string | null;
  /** Reason returned to the caller when guidance is suppressed. */
  reason?: string;
};

export type BrainEvolutionEvent = {
  id: string;
  kind: string;
  claim: string;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  sourceEventIds: string[];
  sourceResolutionIds: string[];
  brainVersionBefore: number | null;
  brainVersionAfter: number | null;
  createdAt: string;
};
