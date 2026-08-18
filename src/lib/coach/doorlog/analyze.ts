import { runBrainCall } from "@/lib/brain";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { parsePitchAnalysis, type PitchAnalysisResult } from "./analysisSchema";

/**
 * Per-pitch analysis (Macro Mode pipeline). Door-to-door rubric (founder spec 2026-08-19): the Today's-Metrics
 * Score Chart grades these five dimensions — objection / talk-listen / questions / tone / close (opener dropped).
 * The score schema is a flexible record, so pitches analyzed under the older v1 rubric (opener/objection/tone/
 * close) still validate; the Score Chart simply averages whichever of the five a period's pitches actually carry.
 * Output validated by the versioned pitchAnalysisSchema; a malformed response is retryable, never a silent write.
 */

// v2 (2026-08-19): rubric changed to the door-to-door five (dropped opener, added talk_listen + questions).
export const ANALYSIS_PROMPT_VERSION = "doorlog-analysis-v2";

/** The door-to-door rubric dimensions the Score Chart grades (founder spec 2026-08-19). */
export const RUBRIC_DIMENSIONS = ["objection", "talk_listen", "questions", "tone", "close"] as const;

function buildAnalysisSystemPrompt(): string {
  return `You are a sales coach reviewing a single door-to-door pitch transcript.

Grade the rep against these rubric dimensions (0-100 each):
- objection: how they handled pushback / hesitation at the door
- talk_listen: the talk-to-listen balance — did they let the prospect talk and respond to it, or monologue?
- questions: how well they asked questions to understand the prospect (discovery / qualifying), not just pitch
- tone: warmth, confidence, pacing
- close: how they asked for the next step

Return STRICT JSON:
{
  "summary": "2-3 sentences on what happened in this pitch, grounded in the transcript",
  "strengths": ["specific things they did well, tied to moments in the transcript"],
  "improvements": ["growth opportunities, framed as a concrete practiceable next step — never a verdict"],
  "scores": { "objection": 0-100, "talk_listen": 0-100, "questions": 0-100, "tone": 0-100, "close": 0-100 }
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
