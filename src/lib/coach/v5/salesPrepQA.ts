import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { getCurrentSalesCorpus, type SalesSession } from "@/lib/data/salesCoach";

/**
 * Prep Time — the interactive "ask the coach" (Sessions build 2). BEFORE a
 * call, the rep asks a free-form question — advice, or "what am I selling?" —
 * and the coach answers, grounded in the company's PRODUCT details (0078) +
 * methodology corpus + the session context.
 *
 * §3.3 — the rep ASKED, so this is on-demand help; the coach advises, it does
 * not take over the call. §3.4 — NEVER fabricate product facts: if the answer
 * needs product details that aren't on file, it says so honestly rather than
 * inventing them. §A21 — reuses the corpus data layer + the control-exempt
 * Sales-Coach LLM path. Never throws; failure returns an honest failed state.
 */

export type PrepAnswer = {
  answer: string;
  hasAnswer: boolean;
  // F3-style (§3.4) — a real generation failure, distinct from an empty ask.
  failed: boolean;
};

const DEFAULT_METHODOLOGY = `
- DISCOVERY before pitch; RAPPORT before persuasion.
- OBJECTIONS are information — acknowledge, understand, then address.
- VALUE before the ask.
`.trim();

function buildQASystemPrompt(
  corpus?: string | null,
  product?: string | null
): string {
  const methodology = corpus?.trim() ? corpus.trim() : DEFAULT_METHODOLOGY;
  const productBlock = product?.trim()
    ? `PRODUCT / OFFER DETAILS (what the rep sells — the ONLY source of product facts; never state a product specific that isn't here):\n${product.trim()}`
    : `PRODUCT / OFFER DETAILS: none on file. If the rep asks about what they're selling (price, features, terms), tell them honestly you don't have the product details and to ask an admin to add them in Settings → Coaching. Do NOT invent product facts.`;

  return `You are a sales coach helping a rep PREPARE before a call. They asked you
a question — answer it directly and practically. Ground technique/approach
answers in the METHODOLOGY; ground "what am I selling" answers in the PRODUCT
DETAILS.

METHODOLOGY:
${methodology}

${productBlock}

RULES:
- Be concise — a few sentences, not an essay. The rep is about to go.
- §3.3 — you advise + prepare; you do NOT script them or take over the call.
- §3.4 — never fabricate. If you don't have what they need, say so plainly.

Respond with plain text (no JSON) — just your answer.`;
}

function sessionContext(s: SalesSession): string {
  const lines = [
    s.clientLabel ? `Client / campaign: ${s.clientLabel}` : null,
    `Context: ${s.context === "in_person" ? "in-person, door-to-door" : "online video call"}`,
    s.territory ? `Where: ${s.territory}` : null,
    s.approach ? `How approaching: ${s.approach}` : null,
    s.offer ? `Offer: ${s.offer}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function answerPrepQuestion(args: {
  companyId: string;
  session: SalesSession;
  question: string;
}): Promise<PrepAnswer> {
  try {
    const [corpus, product] = await Promise.all([
      getCurrentSalesCorpus(args.companyId).catch(() => null),
      getCurrentSalesCorpus(args.companyId, "product").catch(() => null),
    ]);
    const systemPrompt = buildQASystemPrompt(corpus?.content, product?.content);
    const userMessage = `The rep is preparing for this call:
${sessionContext(args.session)}

Their question: "${args.question}"

Answer concisely.`;

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    // Suppression (control gate) — Sales Coach is exempt, so an edge case;
    // treat as an honest non-answer, not a failure.
    if (r.suppressed) return { answer: "", hasAnswer: false, failed: false };
    const answer = (r.text ?? "").trim();
    // An empty model response IS a failure (§3.4 — say "try again", not blank).
    if (!answer) return { answer: "", hasAnswer: false, failed: true };
    return { answer, hasAnswer: true, failed: false };
  } catch {
    return { answer: "", hasAnswer: false, failed: true };
  }
}
