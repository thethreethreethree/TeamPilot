import { runBrainCall } from "@/lib/brain";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { parsePitchAnalysis, type PitchAnalysisResult } from "./analysisSchema";

/**
 * Per-pitch analysis (Macro Mode pipeline). Reuses the EXISTING sales rubric's score dimensions
 * (opener / objection / tone / close — src/lib/coach/v5/salesScore.ts) and coaching tone, so there is
 * ONE definition of "a good pitch" across the product (build-spec 3.3/3.4). Output validated by the
 * versioned pitchAnalysisSchema; a malformed response is a retryable failure, never a silent write.
 */

export const ANALYSIS_PROMPT_VERSION = "doorlog-analysis-v1";

/** The rubric dimensions, reused from the existing sales coach (not a second definition). */
export const RUBRIC_DIMENSIONS = ["opener", "objection", "tone", "close"] as const;

function buildAnalysisSystemPrompt(): string {
  return `You are a sales coach reviewing a single door-to-door pitch transcript.

Grade the rep against these rubric dimensions (0-100 each), the SAME rubric the rest of the Sales Coach uses:
- opener: how they opened and built rapport at the door
- objection: how they handled pushback / hesitation
- tone: warmth, confidence, pacing
- close: how they asked for the next step

Return STRICT JSON:
{
  "summary": "2-3 sentences on what happened in this pitch, grounded in the transcript",
  "strengths": ["specific things they did well, tied to moments in the transcript"],
  "improvements": ["growth opportunities, framed as a concrete practiceable next step — never a verdict"],
  "scores": { "opener": 0-100, "objection": 0-100, "tone": 0-100, "close": 0-100 }
}

Tone law: kind, growth-oriented, specific. Do NOT fabricate moments not in the transcript. This is one pitch
of many — keep it focused; the macro patterns are summarised separately.` + CONVERSATION_IS_DATA;
}

/**
 * Analyze one pitch transcript. Returns null on suppression, empty text (token starvation — logged,
 * retryable), or malformed JSON (retryable) — never a silent partial write.
 */
export async function analyzePitch(args: {
  companyId: string;
  transcript: string;
  outcome: string;
  durationMs: number | null;
}): Promise<PitchAnalysisResult | null> {
  const durationNote =
    args.durationMs != null ? ` (about ${Math.round(args.durationMs / 1000)}s)` : "";
  const r = await runBrainCall({
    companyId: args.companyId,
    basePrompt: buildAnalysisSystemPrompt(),
    messages: [
      {
        role: "user",
        content: `Outcome: ${args.outcome}${durationNote}\n\nTranscript:\n${args.transcript}\n\nAnalyze this pitch.`,
      },
    ],
    maxTokens: 900,
    expectJson: true,
    // Day-1 coaching surface — exempt from the month-1 control window (matches salesReview/dissect).
    controlExempt: true,
  });
  if (r.suppressed) return null;
  if (!r.text || !r.text.trim()) {
    // eslint-disable-next-line no-console
    console.error(
      `[doorlog/analyze] LLM returned EMPTY text (model=${r.model}) — likely token starvation; retryable.`
    );
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(r.text);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[doorlog/analyze] JSON.parse failed (textLen=${r.text.length}) — retryable.`);
    return null;
  }
  return parsePitchAnalysis(raw); // null on schema mismatch → caller retries, never persists garbage
}
