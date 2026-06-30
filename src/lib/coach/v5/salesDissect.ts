import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import {
  getCurrentSalesCorpus,
  type TranscriptSegment,
  type SalesContext,
} from "@/lib/data/salesCoach";
import { buildSalesDissectSystemPrompt } from "./salesDissectPrompt";
import { buildSalesReviewUserMessage } from "./salesReviewPrompt";

/**
 * Live Sales Coach — "Dissect" engine: a deep, full-conversation teaching
 * evaluation. Composes on the same path as the growth review (§A21 —
 * debrief brain + the editable methodology corpus), with a richer output:
 * strengths (with why), growth (with why + next step), the standout
 * strategy the agent used, and an overall teaching note.
 *
 * Never throws; on sparse input / failure / month-1 suppression it returns
 * the honest empty state (§3.4) — no fabricated evaluation.
 */

export type DissectStrength = { point: string; example: string; why: string };
export type DissectGrowth = {
  opportunity: string;
  nextStep: string;
  why: string;
};
export type DissectStrategy = { name: string; example: string; why: string };

export type SalesDissect = {
  hasSignal: boolean;
  strengths: DissectStrength[];
  growthAreas: DissectGrowth[];
  standoutStrategy: DissectStrategy | null;
  overall?: string;
};

const EMPTY: SalesDissect = {
  hasSignal: false,
  strengths: [],
  growthAreas: [],
  standoutStrategy: null,
};

const MIN_AGENT_SEGMENTS = 3;

export async function generateSalesDissect(args: {
  companyId: string;
  sessionTitle?: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SalesDissect> {
  try {
    const agentSegments = args.segments.filter((s) => s.speaker === "agent");
    if (agentSegments.length < MIN_AGENT_SEGMENTS) return EMPTY;

    const corpus = await getCurrentSalesCorpus(args.companyId).catch(() => null);
    const systemPrompt = buildSalesDissectSystemPrompt(corpus?.content);
    const userMessage = buildSalesReviewUserMessage({
      sessionTitle: args.sessionTitle,
      context: args.context,
      segments: args.segments,
    });

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return EMPTY;

    return parseDissect(r.text) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseDissect(text: string): SalesDissect | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const strengths: DissectStrength[] = (
    Array.isArray(o.strengths) ? o.strengths : []
  )
    .map((it) => {
      const x = (it ?? {}) as Record<string, unknown>;
      return { point: str(x.point), example: str(x.example), why: str(x.why) };
    })
    .filter((s) => s.point)
    .slice(0, 4);

  const growthAreas: DissectGrowth[] = (
    Array.isArray(o.growthAreas) ? o.growthAreas : []
  )
    .map((it) => {
      const x = (it ?? {}) as Record<string, unknown>;
      return {
        opportunity: str(x.opportunity),
        nextStep: str(x.nextStep),
        why: str(x.why),
      };
    })
    .filter((g) => g.opportunity && g.nextStep)
    .slice(0, 4);

  let standoutStrategy: DissectStrategy | null = null;
  if (o.standoutStrategy && typeof o.standoutStrategy === "object") {
    const x = o.standoutStrategy as Record<string, unknown>;
    const name = str(x.name);
    if (name) {
      standoutStrategy = {
        name,
        example: str(x.example),
        why: str(x.why),
      };
    }
  }

  const overall = str(o.overall) || undefined;

  // Tone law is structural: an evaluation with no strengths is invalid
  // (never lead with — or consist only of — criticism). Treat it as no
  // signal rather than shipping a tone-law violation.
  const hasSignal = o.hasSignal === false ? false : strengths.length > 0;
  if (!hasSignal) return EMPTY;

  return { hasSignal: true, strengths, growthAreas, standoutStrategy, overall };
}
