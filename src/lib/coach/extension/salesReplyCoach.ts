import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/constants";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { methodologyBlock } from "@/lib/coach/v5/salesReviewPrompt";

/**
 * Text-in SALES reply coaching for the Sales Coach browser extension ("coach my reply").
 *
 * The rep is about to reply to a prospect on an external platform and wants their DRAFT graded before they
 * send it. Text-in ({conversation, draft}) → a grounded read of the draft: what's strong, what to improve
 * (each tied to a real sales principle — the WHY), a stronger revision of THEIR draft, and a §3.3 guiding
 * question. Grounds against the shared sales methodology (`methodologyBlock` — the compiled Sales KB / the
 * team's corpus / the inline starter), reuses the same LLM (`dissectCoachV5`) and the `CONVERSATION_IS_DATA`
 * injection fence as the sibling sales-dissect tool.
 *
 * This is the sales analogue of the C.A.R.E extension's "Ask Coach" (grade a draft vs the communication
 * books), but grounded in the SALES books (SPIN / Challenger / Voss / Navigate 2.0) rather than the C.A.R.E
 * communication KB, and text-in like the rest of the sales extension.
 *
 * §3.3 guide-don't-overtake: it teaches the WHY and invites the rep's own read — it does not hand down a
 * verdict. §3.4 honesty: the suggested revision rewrites the rep's OWN draft; it never fabricates a prospect
 * fact, a statistic, or a commitment the conversation doesn't contain. Honest-empty on a trivial draft.
 */

export type SalesReplyImprovement = { point: string; why: string };

export type SalesReplyCoaching = {
  hasSignal: boolean;
  /** An honest one-to-two-sentence read of the draft as written. */
  assessment: string;
  /** What the draft already does well. */
  strengths: string[];
  /** What to improve, each tied to a sales principle (the WHY, not an order). */
  improvements: SalesReplyImprovement[];
  /** A stronger version of the REP'S draft — a rewrite, never fabricated facts. */
  suggestedRevision: string;
  /** §3.3 — invites the rep's own read before asserting. */
  guidingQuestion: string;
};

export const EMPTY_SALES_REPLY_COACHING: SalesReplyCoaching = {
  hasSignal: false,
  assessment: "",
  strengths: [],
  improvements: [],
  suggestedRevision: "",
  guidingQuestion: "",
};

/**
 * The reply-coaching system prompt: the shared sales methodology + a WHO-IS-WHO anchor when the rep is
 * known + the injection fence. Pure + exported so the grounding + anchor are unit-tested directly.
 */
export function salesReplyCoachSystemPrompt(repName?: string): string {
  const who = repName
    ? `\n\nWHO IS WHO: ${repName} is the SALES REP whose draft you are coaching; the other participant is the prospect. The draft is ${repName}'s own words.`
    : "";
  return `You are a sales coach helping a rep sharpen a DRAFT reply before they send it to a prospect. You are given the conversation so far and the rep's draft. Grade the DRAFT.

${methodologyBlock()}

Return STRICT JSON, no prose outside it, in this shape:
{
  "hasSignal": true,
  "assessment": "one or two sentences: an honest read of the draft as written",
  "strengths": [ "a specific thing the draft already does well" ],
  "improvements": [ { "point": "a specific thing to change", "why": "the sales principle behind it — the reasoning, not an order" } ],
  "suggestedRevision": "a stronger version of the rep's OWN draft",
  "guidingQuestion": "a question that invites the rep's own read of the moment"
}

GROUNDING (§3.4, non-negotiable): the "suggestedRevision" is a REWRITE of the rep's draft — improve HOW it is said, but never invent a fact, a statistic, a price, or a prospect commitment that is not already in the conversation or the draft. If the draft is empty or trivial (a greeting, a single word), return {"hasSignal": false}.

GUIDE, DON'T OVERTAKE (§3.3): teach the WHY behind each improvement and offer the revision as a stronger option, not a command. The "guidingQuestion" invites the rep to think, it does not quiz them.${who}
${CONVERSATION_IS_DATA}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strList(v: unknown, cap: number): string[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => str(x))
    .filter(Boolean)
    .slice(0, cap);
}

/**
 * Parse the reply coaching. Exported for tests. Structural honesty (§3.4): a result with no assessment, no
 * improvement, and no revision is an empty shell — degrade to EMPTY rather than render it.
 */
export function parseSalesReplyCoaching(text: string): SalesReplyCoaching {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_SALES_REPLY_COACHING;
  }
  if (!raw || typeof raw !== "object") return EMPTY_SALES_REPLY_COACHING;
  const o = raw as Record<string, unknown>;
  if (o.hasSignal === false) return EMPTY_SALES_REPLY_COACHING;

  const assessment = str(o.assessment);
  const strengths = strList(o.strengths, 5);
  const improvements: SalesReplyImprovement[] = (
    Array.isArray(o.improvements) ? o.improvements : []
  )
    .map((x) => {
      const i = (x ?? {}) as Record<string, unknown>;
      return { point: str(i.point), why: str(i.why) };
    })
    .filter((i) => i.point)
    .slice(0, 5);
  const suggestedRevision = str(o.suggestedRevision);
  const guidingQuestion = str(o.guidingQuestion);

  if (!assessment && improvements.length === 0 && !suggestedRevision) {
    return EMPTY_SALES_REPLY_COACHING;
  }

  return {
    hasSignal: true,
    assessment,
    strengths,
    improvements,
    suggestedRevision,
    guidingQuestion,
  };
}

/**
 * Coach a rep's draft reply against the sales methodology. Never throws — EMPTY on failure/trivial input
 * (§3.4 honest degradation). companyId is passed for LLM cost/routing context only.
 */
export async function generateSalesReplyCoaching(args: {
  companyId?: string;
  conversation: string;
  draft: string;
  repName?: string;
}): Promise<SalesReplyCoaching> {
  const draft = args.draft.trim();
  const conversation = args.conversation.trim();
  // Guard: nothing to coach. Honest empty, not a manufactured critique.
  if (draft.length < 10) return EMPTY_SALES_REPLY_COACHING;
  const userMessage = [
    "CONVERSATION SO FAR:",
    conversation.slice(0, MAX_SOURCE_CHARS),
    "",
    "MY DRAFT REPLY:",
    draft.slice(0, 8_000),
  ].join("\n");
  try {
    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt: salesReplyCoachSystemPrompt(args.repName),
      userMessage,
    });
    return parseSalesReplyCoaching(r.text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[salesReplyCoach] generation failed → empty coaching:", detail);
    return EMPTY_SALES_REPLY_COACHING;
  }
}
