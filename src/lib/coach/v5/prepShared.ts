import type { SalesSession } from "@/lib/data/salesCoach";

/**
 * Shared prep helpers (audit F3 — §A21, one source instead of per-engine
 * copies): the fallback methodology + the call's captured context as prompt
 * lines. Used by both the pre-knock briefing (salesPrep) and Prep Time Q&A
 * (salesPrepQA). Client-free (only a type import), server engines import it.
 */

export const DEFAULT_METHODOLOGY = `
SALES METHODOLOGY (reason FROM it; adapt to THIS call):
- DISCOVERY before pitch: open on their situation, not your offer.
- RAPPORT: trust precedes persuasion; treat concerns as legitimate.
- OBJECTIONS are information — acknowledge, understand, then address.
- VALUE before the ask: don't close before the value has landed.
`.trim();

/**
 * Product/offer block for a REVIEW/critique prompt (defined ONCE and shared, used by every after-pitch review
 * engine: narrative, moments, scores). Founder 2026-07-31: the post-call review must be product-aware, so the
 * coach critiques against what the team actually sells. When set, ground the critique in the real product;
 * when absent, never invent product specifics. Mirrors salesPrep's forward-looking product block, tuned for
 * critique instead of prep.
 */
export function reviewProductBlock(product?: string | null): string {
  return product?.trim()
    ? `\n\nPRODUCT / OFFER DETAILS (what the rep is actually selling — judge the call against THIS; flag any product claim that contradicts it, and credit accurate product framing; NEVER invent product specifics beyond it):\n${product.trim()}`
    : `\n\n(No product details on file — assess delivery + methodology only; do NOT invent or assume product specifics.)`;
}

/** The call's captured (Phase 2) context as prompt lines. */
export function sessionContextLines(s: SalesSession): string[] {
  return [
    s.clientLabel ? `Client / campaign: ${s.clientLabel}` : null,
    `Context: ${s.context === "in_person" ? "in-person, door-to-door" : "online video call"}`,
    s.territory ? `Where: ${s.territory}` : null,
    s.approach ? `How approaching: ${s.approach}` : null,
    s.offer ? `Offer: ${s.offer}` : null,
  ].filter((x): x is string => Boolean(x));
}
