import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/constants";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";

/**
 * Text-in SALES dissect for the Sales Coach browser extension.
 *
 * The sibling `generateSalesDissect` (coach/v5) consumes speaker-labeled
 * `TranscriptSegment[]` from a DB coaching_session — it does not fit the extension,
 * whose only input is the RAW TEXT of the conversation the rep is viewing on an
 * external platform (Gmail / WhatsApp / LinkedIn / …). So this mirrors the proven
 * C.A.R.E text-in engine (`generateConversationDissect`): text-in → grounded read →
 * honest-empty on thin input, reusing the same LLM (`dissectCoachV5`), the same
 * source cap, and the same `CONVERSATION_IS_DATA` injection fence.
 *
 * Output is SALES-shaped (what's working / the opportunity / the next move) rather
 * than the C.A.R.E problem-diagnosis shape, because a rep mid-conversation needs a
 * read of their APPROACH, not a customer-problem root cause. §3.3: it ends with a
 * guiding question that invites the rep's own read before asserting. §3.4: every
 * "working" point must quote a REAL line from the pasted text or it is dropped — a
 * hallucinated strength never renders as fact.
 */

export type SalesStrength = { point: string; excerpt: string };

export type SalesTextDissect = {
  hasSignal: boolean;
  summary: string;
  /** What the rep is doing well, each grounded in a real quote from the text. */
  strengths: SalesStrength[];
  /** The single biggest thing to improve in this conversation. */
  opportunity: string;
  /** The concrete next move — what to say / do next. */
  nextMove: string;
  /** §3.3 — invites the rep's own read first, never hands down a verdict. */
  guidingQuestion: string;
};

export const EMPTY_SALES_TEXT_DISSECT: SalesTextDissect = {
  hasSignal: false,
  summary: "",
  strengths: [],
  opportunity: "",
  nextMove: "",
  guidingQuestion: "",
};

const SALES_DISSECT_SYSTEM = `You are a sales coach reading a conversation a sales rep is having with a PROSPECT, scanned from the platform the rep is viewing. Diagnose the REP'S approach in this exchange — you are coaching the rep, not the prospect.

Return STRICT JSON, no prose outside it, in this shape:
{
  "hasSignal": true,
  "summary": "one or two sentences: where this sales conversation actually is right now",
  "strengths": [ { "point": "a specific thing the rep did well", "excerpt": "the REAL quote from the rep that shows it" } ],
  "opportunity": "the single biggest thing the rep could do better in THIS conversation",
  "nextMove": "the concrete next thing the rep should say or do",
  "guidingQuestion": "a question that invites the rep's OWN read of the moment"
}

GROUNDING (§3.4, non-negotiable): every "excerpt" MUST be a verbatim quote copied from the pasted conversation below — do not paraphrase, do not invent. If you cannot find a real quote for a strength, omit that strength. Never fabricate a statistic, a quote, or a prospect reaction that is not in the text.

GUIDE, DON'T OVERTAKE (§3.3): "guidingQuestion" comes FIRST in spirit — the read is a participant in the rep's thinking, not a verdict handed down. Offer the opportunity and next move as reasoning (the WHY), not as orders.

HONEST-EMPTY (§0 / §3.4): if the pasted text is too thin to read fairly — a fragment, a single line, no real exchange — return {"hasSignal": false}. A short-but-real exchange still gets a short, REAL read; only genuine non-signal returns false. Do not manufacture a lesson from nothing.
${CONVERSATION_IS_DATA}`;

/**
 * The sales-dissect system prompt, plus a WHO-IS-WHO anchor when the rep is known.
 * Pure + exported so the anchor is unit-tested directly (the engine calls the LLM).
 * The scanned thread is unlabeled, so naming the rep keeps the read from mistaking
 * the prospect's words for the rep's.
 */
export function salesTextDissectSystemPrompt(repName?: string): string {
  return repName
    ? `${SALES_DISSECT_SYSTEM}\n\nWHO IS WHO: in the pasted conversation, ${repName} is the SALES REP; the other participant is the prospect. Attribute each move on that basis — never mistake the prospect's words for ${repName}'s.`
    : SALES_DISSECT_SYSTEM;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Parse + ground the sales dissect. Exported for tests. Enforces §3.4: every
 * strength excerpt must actually appear (whole, whitespace-normalized) in the source
 * text, or the strength is dropped — a hallucinated quote never renders as fact.
 * hasSignal is structural: no summary AND no grounded strength ⇒ no signal.
 */
export function parseSalesTextDissect(
  text: string,
  sourceText: string
): SalesTextDissect {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_SALES_TEXT_DISSECT;
  }
  if (!raw || typeof raw !== "object") return EMPTY_SALES_TEXT_DISSECT;
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false) return EMPTY_SALES_TEXT_DISSECT;

  // §3.4: a strength excerpt must be a REAL quote from the pasted text, in FULL. A
  // prefix match would let the model keep a real opening and fabricate the tail, and
  // the fabricated suffix would render as evidence — require the whole excerpt to
  // appear, whitespace-normalized on both sides so a reformatted-but-real quote passes.
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const haystack = normalize(sourceText);
  const strengths: SalesStrength[] = (
    Array.isArray(o.strengths) ? o.strengths : []
  )
    .map((x) => {
      const s = (x ?? {}) as Record<string, unknown>;
      return { point: str(s.point), excerpt: str(s.excerpt) };
    })
    .filter((s) => s.point && s.excerpt && haystack.includes(normalize(s.excerpt)))
    .slice(0, 5);

  const summary = str(o.summary);
  const opportunity = str(o.opportunity);
  const nextMove = str(o.nextMove);
  const guidingQuestion = str(o.guidingQuestion);

  // Structural honesty (§3.4): if nothing survived grounding AND there is no summary,
  // this is an empty shell, not a read — degrade to EMPTY rather than render it.
  if (!summary && strengths.length === 0 && !opportunity && !nextMove) {
    return EMPTY_SALES_TEXT_DISSECT;
  }

  return {
    hasSignal: true,
    summary,
    strengths,
    opportunity,
    nextMove,
    guidingQuestion,
  };
}

/**
 * Dissect a pasted SALES conversation. Never throws — returns EMPTY on failure or
 * sparse input (§3.4 honest degradation). companyId is passed for LLM cost/routing
 * context only.
 */
export async function generateSalesTextDissect(args: {
  companyId?: string;
  sourceText: string;
  /** The sales rep, so the read attributes moves to the right side of an unlabeled thread. */
  repName?: string;
}): Promise<SalesTextDissect> {
  const source = args.sourceText.trim();
  // Guard: too little to read. Honest empty, not a fabricated pitch analysis.
  if (source.length < 40) return EMPTY_SALES_TEXT_DISSECT;
  try {
    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt: salesTextDissectSystemPrompt(args.repName),
      userMessage: source.slice(0, MAX_SOURCE_CHARS),
    });
    return parseSalesTextDissect(r.text, source);
  } catch (err) {
    // Fail-soft to EMPTY (the never-throws contract the route relies on) but do NOT
    // swallow silently — a provider outage rendering as "nothing to read" is
    // indistinguishable from a genuinely thin thread (§3.4). Log the real cause.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[salesTextDissect] generation failed → empty dissect:", detail);
    return EMPTY_SALES_TEXT_DISSECT;
  }
}
