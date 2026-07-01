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
