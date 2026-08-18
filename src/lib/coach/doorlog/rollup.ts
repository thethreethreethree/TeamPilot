import { runBrainCall } from "@/lib/brain";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { parsePatternRollup, type PatternRollupResult } from "./analysisSchema";

/**
 * Macro pattern rollup (Macro Mode — the Report Card's centre of gravity, 3.4b). Finds recurring
 * patterns ACROSS a rep's pitches in a period — NOT a per-pitch summary — and a trend vs. the previous
 * period. Reuses the `runBrainCall` chokepoint (DeepSeek→Anthropic cascade, control-exempt like the rest
 * of the day-1 Sales Coach) and the versioned `parsePatternRollup` contract (malformed → retryable).
 */

export const ROLLUP_PROMPT_VERSION = "doorlog-rollup-v1";

/**
 * Cap on the number of pitches folded into the prompt's PER-PITCH DETAIL block. The worker samples up to 500
 * pitches; concatenating all of them (summary + strengths + improvements + scores each) built a prompt tens of
 * thousands of tokens long, which drove the reasoning model past its output headroom → an EMPTY rollup that
 * never persisted, so the highest-volume reps' `all_time` Report Card card stayed blank AND a paid LLM call
 * burned on every new pitch forever (audit 2026-08-19). The outcome DISTRIBUTION still covers every sampled
 * pitch (it's counted separately); only the verbose detail is bounded to the most-recent N — enough to see a
 * recurring pattern without starving the model.
 */
export const ROLLUP_MAX_DETAIL_PITCHES = 40;

/** One period's worth of per-pitch signal, distilled for the rollup. */
export type PitchSignal = {
  outcome: string; // knock_outcome
  summary: string;
  strengths: string[];
  improvements: string[];
  scores: Record<string, number>;
};

function buildRollupSystemPrompt(): string {
  return `You are a sales coach reviewing a door-to-door rep's pitches over a period of time.

Your job is to find the RECURRING PATTERNS across ALL of these pitches — NOT to summarise any single
pitch. Look for what shows up again and again: habits, phrasings, moves that repeatedly precede a SALE,
and habits that repeatedly precede a NO. Correlate behaviour with the OUTCOME distribution you're given —
a pattern only matters if it tracks with closing more or less often.

Return STRICT JSON with this exact shape:
{
  "headline": "one sentence naming the single most important pattern this period",
  "patterns_good": ["recurring behaviours that are working — each tied to outcomes"],
  "patterns_bad": ["recurring behaviours that are hurting — framed as growth, never a verdict"],
  "trend": { "direction": "improving" | "regressing" | "flat", "note": "how this period compares to the previous one" }
}

Tone law: kind, growth-oriented, specific. Patterns must be grounded in the pitches given — never invent a
pattern that isn't supported by the data. If there are too few pitches to see a pattern, say so plainly in
the headline and return empty pattern arrays.` + CONVERSATION_IS_DATA;
}

export function buildRollupUserMessage(args: {
  pitches: PitchSignal[];
  outcomeCounts: Record<string, number>;
  previousHeadline: string | null;
}): string {
  const distribution = Object.entries(args.outcomeCounts)
    .map(([o, n]) => `${o}: ${n}`)
    .join(", ");
  // Bound the per-pitch detail (pitches arrive most-recent-first) so a prolific rep can't starve the model.
  const detail = args.pitches.slice(0, ROLLUP_MAX_DETAIL_PITCHES);
  const pitchBlock = detail
    .map(
      (p, i) =>
        `Pitch ${i + 1} [outcome: ${p.outcome}] scores=${JSON.stringify(p.scores)}\n` +
        `  summary: ${p.summary}\n  strengths: ${p.strengths.join("; ")}\n  improvements: ${p.improvements.join("; ")}`
    )
    .join("\n\n");
  const sampleNote =
    args.pitches.length > ROLLUP_MAX_DETAIL_PITCHES
      ? `\n(Showing the ${ROLLUP_MAX_DETAIL_PITCHES} most recent pitches in detail; the outcome distribution above covers all ${args.pitches.length}.)`
      : "";
  return (
    `Outcome distribution this period: ${distribution || "(none)"}\n` +
    (args.previousHeadline
      ? `Previous period's headline pattern: "${args.previousHeadline}"\n`
      : `No previous period to compare against (treat trend as "flat").\n`) +
    `\nThe pitches:\n\n${pitchBlock}${sampleNote}\n\nFind the recurring patterns across them.`
  );
}

/**
 * Generate a rep's macro pattern summary for a period. Returns null on suppression, empty text
 * (token starvation — logged, retryable), or malformed JSON (retryable) — never a silent partial write.
 */
export async function generateRepPatternRollup(args: {
  companyId: string;
  pitches: PitchSignal[];
  outcomeCounts: Record<string, number>;
  previousHeadline: string | null;
}): Promise<PatternRollupResult | null> {
  const r = await runBrainCall({
    companyId: args.companyId,
    basePrompt: buildRollupSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildRollupUserMessage({
          pitches: args.pitches,
          outcomeCounts: args.outcomeCounts,
          previousHeadline: args.previousHeadline,
        }),
      },
    ],
    maxTokens: 1200,
    expectJson: true,
    // Sales Coach runs day-1 — exempt from the 3.4 month-1 control window (matches salesReview/dissect).
    controlExempt: true,
  });
  if (r.suppressed) return null;
  if (!r.text || !r.text.trim()) {
    // eslint-disable-next-line no-console
    console.error(
      `[doorlog/rollup] LLM returned EMPTY text (model=${r.model}) — likely reasoning-model token starvation.`
    );
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(r.text);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[doorlog/rollup] JSON.parse failed (textLen=${r.text.length}) — retryable.`);
    return null;
  }
  return parsePatternRollup(raw); // null on schema mismatch → caller retries, never persists garbage
}
