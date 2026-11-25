/**
 * Shared Sales Coach outcome labels + display order (audit F7 — §A21, one
 * source instead of four copies). Client-safe: NO server-only imports, so
 * both the server engines and the client pages can import it. The enum
 * VALUES + zod live in salesCoach.ts (server); these are just the human
 * labels. Keep the keys in sync with SALES_OUTCOMES.
 */
export type SalesOutcome =
  | "sold"
  | "follow_up"
  | "no_sale"
  | "no_contact"
  | "undecided";

export const OUTCOME_LABELS: Record<SalesOutcome, string> = {
  sold: "Sold",
  follow_up: "Follow-up",
  no_sale: "No sale",
  no_contact: "No contact",
  undecided: "Undecided",
};

export const OUTCOME_ORDER: SalesOutcome[] = [
  "sold",
  "follow_up",
  "no_sale",
  "no_contact",
  "undecided",
];

/** Label for any outcome string, tolerant of unknown values. */
export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome as SalesOutcome] ?? outcome;
}

/**
 * Outcome tone (2026-11-25; Gong ledger F26.10; founder picker "Green / grey / amber"): positive = Sold (green),
 * caution = No sale (amber — a warm caution, never red on a rep's call), neutral = everything else (grey). Door-log
 * outcomes use the same three: Not interested is the door's "no sale". One rule for every badge.
 */
export type OutcomeTone = "positive" | "neutral" | "caution";
export function outcomeTone(outcome: string | null | undefined): OutcomeTone {
  if (outcome === "sold") return "positive";
  if (outcome === "no_sale" || outcome === "not_interested") return "caution";
  return "neutral";
}
/**
 * Did the call reach someone? (2026-11-26; Gong ledger F25.8 "Outcome connect status": each outcome is Connected or Not
 * connected, which drives the connect rate.) "No contact" is the one outcome where nobody was reached; Sold, Follow-up,
 * No sale and Undecided all were. An absent or unknown outcome is null — not counted either way.
 */
export function outcomeConnected(outcome: string | null | undefined): boolean | null {
  if (outcome === "no_contact") return false;
  if (outcome === "sold" || outcome === "follow_up" || outcome === "no_sale" || outcome === "undecided") return true;
  return null;
}

/** Saturated in both themes (theme audit: no pale text that vanishes on light). */
export const OUTCOME_TONE_CLASS: Record<OutcomeTone, string> = {
  positive: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  neutral: "bg-zinc-500/10 text-secondary",
  caution: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};
