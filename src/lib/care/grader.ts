import "server-only";
import { gradeCoachV5 } from "@/lib/claude";

/**
 * Coach v6 — count-based rubric for Care agent replies.
 *
 * Source assets (ThinkerThinker.md):
 *   - A11 "The System does not judge; it mirrors" — Coach surfaces
 *     COUNTS (facts), the user renders the verdict.
 *   - A17 "Multi-contract design" — three contracts as design
 *     drivers: identification (counts), guidance (next-step
 *     surfaces in the UI under risk counts), experiential
 *     (positive counts surface first and prominently — what the
 *     agent did well is structurally more visible than gaps).
 *   - A18 "Labels invite, not penalize" — the display label IS
 *     the count, not an evaluative adjective. Leader-of-6-months
 *     test passes because there's no comparative verdict to
 *     stack-rank.
 *   - A16 direction 2 — when the message being graded has a
 *     Co-Pilot reasoning attached, the grader reads it and notes
 *     in reason_internal whether the shape choice was deliberate.
 *
 * The previous (v5) rubric returned a verdict-shaped enum
 * (productive / neutral / needs_guidance / withheld). That was
 * the A11 violation captured in the C.A.R.E asset audit. v6
 * returns counts + a back-compat derived enum so existing UI and
 * downstream analytics keep working during the transition.
 *
 * Why the counts are these
 * ────────────────────────
 * Each count was chosen to be language-verifiable from the
 * reply text alone (positive presence) or context-verifiable
 * (risks vs the conversation + product context). Per A4 this
 * specific list is an explicit uncertainty — categories may
 * evolve once real graded replies surface gaps the categories
 * don't capture. Adjust without a migration via the JSONB
 * coach_counts column.
 *
 * Positive (each 0 or 1):
 *   - acknowledged    — Did the reply name what the customer
 *                       said? Even one sentence counts.
 *   - answered        — Did the reply answer the question OR
 *                       honestly hand off? "I don't know" counts
 *                       if paired with a hand-off; vague non-
 *                       answer doesn't.
 *   - next_step       — Is there a concrete move the customer can
 *                       take? "Reply with X, click Y, our team
 *                       will reach out by Z" — anything actionable.
 *
 * Risks (counts, can exceed 1):
 *   - unsupported_absolutes — claims like "always", "never",
 *                             "guaranteed" not grounded in
 *                             product context.
 *   - fabricated_specifics  — prices, features, policies the
 *                             reply asserted that aren't in the
 *                             product context.
 *   - empty_filler          — corporate-shaped throat-clearing
 *                             ("we appreciate your patience",
 *                             "thank you for reaching out").
 */

export type CoachCounts = {
  positive: {
    acknowledged: 0 | 1;
    answered: 0 | 1;
    next_step: 0 | 1;
  };
  risks: {
    unsupported_absolutes: number;
    fabricated_specifics: number;
    empty_filler: number;
  };
  reason_internal: string;
};

export type CoachV6Result = {
  counts: CoachCounts | null; // null when grader withheld
  /**
   * Derived enum kept for back-compat with v5-era UI and the
   * agent_growth_snapshot aggregation. Mapping:
   *   any risk > 0  OR  < 2 of 3 positives present  → needs_guidance
   *   all 3 positives present  AND  all risks = 0   → productive
   *   otherwise                                     → neutral
   * The derivation itself is verdict-shaped; that's accepted
   * here ONLY for back-compat. New surfaces should read .counts
   * directly per A11.
   */
  derivedGrade: "productive" | "neutral" | "needs_guidance" | "withheld";
  reasonInternal: string;
};

const SYSTEM = `You are grading a customer support agent's reply. You do NOT render a verdict on the reply. You COUNT facts in the reply and surface those counts so the agent and their team lead can read the pattern themselves.

You return STRICT JSON, no markdown, no commentary, in this exact shape:

{
  "positive": {
    "acknowledged": 0 | 1,
    "answered": 0 | 1,
    "next_step": 0 | 1
  },
  "risks": {
    "unsupported_absolutes": <integer ≥ 0>,
    "fabricated_specifics": <integer ≥ 0>,
    "empty_filler": <integer ≥ 0>
  },
  "reason_internal": "<1-2 sentences, internal-only, that help the agent understand what to consider — NOT a verdict>"
}

Count definitions:

POSITIVE (each is 0 or 1):
- acknowledged: Did the reply name or acknowledge what the customer said in their most recent message? Even one sentence ("That delay sounds frustrating", "Got it — you're trying to X") counts as 1. A reply that jumps straight to instructions without naming the situation counts as 0.
- answered: Did the reply answer the customer's question OR honestly hand off ("I don't have access to that — let me get someone who does")? A vague non-answer ("we'll look into it") without a hand-off counts as 0.
- next_step: Is there a concrete move the customer can take? "Reply with X", "Click Y", "Our team will reach out by Z" — anything actionable on the customer's side or a committed action on the team's side. Counts as 1 if present, 0 if not.

RISKS (counts ≥ 0):
- unsupported_absolutes: How many absolute claims ("always", "never", "guaranteed", "100%") appeared that aren't grounded in the product context below? Each instance = 1.
- fabricated_specifics: How many specific claims about prices, features, policies, or timelines did the reply assert that aren't grounded in the product context? Each instance = 1.
- empty_filler: How many empty corporate-shaped sentences appeared ("we appreciate your patience", "thank you for reaching out", "please rest assured")? Each instance = 1.

reason_internal: 1-2 sentences for the agent's growth. NOT a verdict. Examples of good shape:
- "Customer asked about refund timing; reply acknowledged and offered a next step but didn't answer the specific question."
- "Reply is action-oriented but skipped acknowledgment. Thread context shows multiple prior acknowledgments — consider whether a fresh one was needed."
- "Two unsupported absolutes ('always' and 'guaranteed') about delivery timing — neither is grounded in the product context."

Examples of WRONG shape (these are verdicts, NOT count-explanations):
- ❌ "Reply reads as dismissive."
- ❌ "This is a poor response."
- ❌ "Agent should be warmer."

Return ONLY the JSON. No commentary, no markdown fences.`;

export async function gradeCareAgentReply(args: {
  customerLastMessage: string;
  agentReply: string;
  conversationContext?: string;
  productContext?: string;
  coPilotReasoning?: string | null;
}): Promise<CoachV6Result> {
  const sections = [
    args.conversationContext
      ? `Conversation so far:\n${args.conversationContext}`
      : null,
    args.productContext
      ? `Product context the agent is grounded in:\n${args.productContext}`
      : null,
    `Customer's most recent message:\n${args.customerLastMessage}`,
    `Agent's reply (the one you're counting):\n${args.agentReply}`,
    // §A16 direction 2 composition — if the message was drafted
    // with the AI Co-Pilot, the Co-Pilot's reasoning explains
    // shape choices. Surface it to the grader so deliberate
    // choices don't get counted as gaps.
    args.coPilotReasoning
      ? `AI Co-Pilot's reasoning when drafting this reply (internal context — read this when assessing whether shape choices were deliberate, but the COUNTS still reflect what's literally in the reply):\n${args.coPilotReasoning}`
      : null,
    `Count the facts. Return STRICT JSON.`,
  ].filter(Boolean);

  try {
    const r = await gradeCoachV5({
      systemPrompt: SYSTEM,
      userMessage: sections.join("\n\n"),
    });
    if (r.suppressed) {
      return {
        counts: null,
        derivedGrade: "withheld",
        reasonInternal: "",
      };
    }
    const parsed = JSON.parse(r.text);
    const counts = validateCounts(parsed);
    if (!counts) {
      return {
        counts: null,
        derivedGrade: "withheld",
        reasonInternal: "",
      };
    }
    return {
      counts,
      derivedGrade: deriveGrade(counts),
      reasonInternal: counts.reason_internal,
    };
  } catch {
    return {
      counts: null,
      derivedGrade: "withheld",
      reasonInternal: "",
    };
  }
}

// Exported for test: validateCounts sanitizes the model's self-report into
// trustworthy countables (positives → 0/1, risks → non-negative ints, malformed
// → null), and deriveGrade computes the grade FROM those countables (§3.5 —
// the grade is derived from what's countable, never the model's opinion). Both
// are constitutional invariants worth pinning.
export function validateCounts(raw: unknown): CoachCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = r.positive as Record<string, unknown> | undefined;
  const k = r.risks as Record<string, unknown> | undefined;
  if (!p || !k) return null;
  const intish = (v: unknown): number => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      return Math.floor(v);
    }
    return 0;
  };
  const zeroOne = (v: unknown): 0 | 1 => (intish(v) > 0 ? 1 : 0);
  return {
    positive: {
      acknowledged: zeroOne(p.acknowledged),
      answered: zeroOne(p.answered),
      next_step: zeroOne(p.next_step),
    },
    risks: {
      unsupported_absolutes: intish(k.unsupported_absolutes),
      fabricated_specifics: intish(k.fabricated_specifics),
      empty_filler: intish(k.empty_filler),
    },
    reason_internal:
      typeof r.reason_internal === "string"
        ? r.reason_internal.slice(0, 600)
        : "",
  };
}

export function deriveGrade(c: CoachCounts): "productive" | "neutral" | "needs_guidance" {
  const positives =
    c.positive.acknowledged + c.positive.answered + c.positive.next_step;
  const totalRisks =
    c.risks.unsupported_absolutes +
    c.risks.fabricated_specifics +
    c.risks.empty_filler;
  if (totalRisks > 0 || positives < 2) return "needs_guidance";
  if (positives === 3 && totalRisks === 0) return "productive";
  return "neutral";
}
