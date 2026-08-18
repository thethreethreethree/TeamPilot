import { z } from "zod";

/**
 * LLM output contracts for Macro Mode (3.4). Decision-independent of Q2/Q4 — the JSON shapes are fixed
 * by the spec and the existing sales rubric. Both AI steps go through the `llmCall` chokepoint with these
 * schemas; a response that fails to parse is a RETRYABLE job failure, never a silent write (5.7, and the
 * repo's standing "validate LLM JSON, treat malformed as failure" rule).
 */

/** (a) Per-pitch analysis — reuses the existing rubric's score dimensions (0..100). */
export const pitchAnalysisSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  scores: z.record(z.string(), z.number().min(0).max(100)).default({}),
});
export type PitchAnalysisResult = z.infer<typeof pitchAnalysisSchema>;

/** (b) Pattern rollup — the macro layer. Recurring patterns ACROSS pitches + trend vs. the previous period. */
export const patternRollupSchema = z.object({
  headline: z.string().min(1),
  patterns_good: z.array(z.string()).default([]),
  patterns_bad: z.array(z.string()).default([]),
  trend: z.object({
    direction: z.enum(["improving", "regressing", "flat"]),
    note: z.string().optional(),
  }),
});
export type PatternRollupResult = z.infer<typeof patternRollupSchema>;

/** Parse an LLM analysis response; null on malformed so the caller fails the job for retry (never persists
 *  a partial/garbage analysis). */
export function parsePitchAnalysis(raw: unknown): PitchAnalysisResult | null {
  const r = pitchAnalysisSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Parse an LLM rollup response; null on malformed (retryable failure, never a silent write). */
export function parsePatternRollup(raw: unknown): PatternRollupResult | null {
  const r = patternRollupSchema.safeParse(raw);
  return r.success ? r.data : null;
}
