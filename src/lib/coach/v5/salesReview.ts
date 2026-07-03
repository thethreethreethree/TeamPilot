import "server-only";
import { debriefCoachV5 } from "@/lib/claude";
import {
  getCurrentSalesCorpus,
  type TranscriptSegment,
  type SalesContext,
} from "@/lib/data/salesCoach";
import {
  buildSalesReviewSystemPrompt,
  buildSalesReviewUserMessage,
} from "./salesReviewPrompt";

/**
 * Live Sales Coach — post-call growth review engine.
 *
 * Extends the Coach v5 debrief pattern (§A21 — same LLM path, same
 * empty-state honesty) to a diarized sales transcript. Returns the
 * tone-law structure: strengths (validated, with transcript examples)
 * FIRST, then growth opportunities (each with a concrete next step),
 * then a warm closing.
 *
 * Never throws — a review failure must never block the workflow that
 * triggered it (mirrors generateConversationDebrief). On any failure or
 * sparse input it returns the honest empty state (§3.4): no fabricated
 * lesson.
 */

export type SalesReviewStrength = { point: string; example: string };
export type SalesReviewGrowth = { opportunity: string; nextStep: string };

export type SalesReview = {
  hasSignal: boolean;
  strengths: SalesReviewStrength[];
  growthAreas: SalesReviewGrowth[];
  closing?: string;
};

const EMPTY_REVIEW: SalesReview = {
  hasSignal: false,
  strengths: [],
  growthAreas: [],
};

/** Need at least this many AGENT utterances to honestly coach. Below
 *  this, there isn't enough of the agent's own behaviour to teach from
 *  — fabricating a lesson is the dishonesty the product refuses. */
const MIN_AGENT_SEGMENTS = 3;

export async function generateSalesReview(args: {
  companyId: string;
  sessionTitle?: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SalesReview> {
  try {
    const agentSegments = args.segments.filter((s) => s.speaker === "agent");
    if (agentSegments.length < MIN_AGENT_SEGMENTS) {
      return EMPTY_REVIEW;
    }

    // The company's own saved corpus (if any) overrides the built-in
    // methodology for THIS company's reviews (§5). Never throws — a corpus
    // read failure falls back to the built-in via undefined.
    const corpus = await getCurrentSalesCorpus(args.companyId).catch(
      () => null
    );
    const systemPrompt = buildSalesReviewSystemPrompt(corpus?.content);
    const userMessage = buildSalesReviewUserMessage({
      sessionTitle: args.sessionTitle,
      context: args.context,
      segments: args.segments,
    });

    const r = await debriefCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
      // Sales Coach runs day-1 — exempt from the §3.4 control window.
      controlExempt: true,
    });
    if (r.suppressed) return EMPTY_REVIEW;

    return parseSalesReview(r.text) ?? EMPTY_REVIEW;
  } catch {
    return EMPTY_REVIEW;
  }
}

function parseSalesReview(text: string): SalesReview | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const strengths = toStrengthArray(o.strengths).slice(0, 3);
  const growthAreas = toGrowthArray(o.growthAreas).slice(0, 3);
  const closing =
    typeof o.closing === "string" && o.closing.trim().length > 0
      ? o.closing.trim()
      : undefined;

  // The tone law is structural: a review with no strengths is invalid
  // (you must never lead with — or consist only of — criticism). If the
  // model returned growth areas but no strengths, treat it as no signal
  // rather than shipping a tone-law violation.
  const hasSignal = o.hasSignal === false ? false : strengths.length > 0;
  if (!hasSignal) return EMPTY_REVIEW;

  return { hasSignal: true, strengths, growthAreas, closing };
}

function toStrengthArray(v: unknown): SalesReviewStrength[] {
  if (!Array.isArray(v)) return [];
  const out: SalesReviewStrength[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const point = typeof o.point === "string" ? o.point.trim() : "";
      // Head-of-sales directive (2026-07-03): "What you did well" shows the
      // headline only — no explanation/quote. Force example empty so the UI
      // never renders one, regardless of what the model returns (belt +
      // suspenders with the prompt; also strips any older stored example).
      if (point) out.push({ point, example: "" });
    }
  }
  return out;
}

function toGrowthArray(v: unknown): SalesReviewGrowth[] {
  if (!Array.isArray(v)) return [];
  const out: SalesReviewGrowth[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const opportunity =
        typeof o.opportunity === "string" ? o.opportunity.trim() : "";
      const nextStep = typeof o.nextStep === "string" ? o.nextStep.trim() : "";
      if (opportunity && nextStep) out.push({ opportunity, nextStep });
    }
  }
  return out;
}
