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
