import { describe, it, expect } from "vitest";
import { OUTCOME_LABELS, OUTCOME_ORDER, outcomeLabel } from "../outcomeLabels";

/**
 * Shared sales-outcome labels (F7 consolidation — one source instead of four copies).
 *
 * Two things TypeScript does NOT catch, so they're pinned here:
 *  1. outcomeLabel() must be TOLERANT of an unknown outcome string — return the raw value,
 *     never crash or render "undefined". A new enum value that reaches the UI before its
 *     label is added should degrade to showing the raw code, not break the page.
 *  2. OUTCOME_ORDER is typed `SalesOutcome[]`, which TS is happy to let go INCOMPLETE (a
 *     missing element) or hold DUPLICATES. It drives display order, so if a new outcome is
 *     added to OUTCOME_LABELS but forgotten in OUTCOME_ORDER (or vice versa), that outcome
 *     silently vanishes from / duplicates in the ordered UI. This locks the two in sync.
 */
describe("sales outcome labels", () => {
  it("maps each known outcome to its human label", () => {
    expect(outcomeLabel("sold")).toBe("Sold");
    expect(outcomeLabel("follow_up")).toBe("Follow-up");
    expect(outcomeLabel("no_sale")).toBe("No sale");
    expect(outcomeLabel("no_contact")).toBe("No contact");
    expect(outcomeLabel("undecided")).toBe("Undecided");
  });

  it("is tolerant of an unknown outcome — returns the raw value, never crashes or blanks", () => {
    expect(outcomeLabel("brand_new_outcome")).toBe("brand_new_outcome");
    expect(outcomeLabel("")).toBe("");
  });

  it("OUTCOME_ORDER covers EXACTLY the OUTCOME_LABELS keys (no drift, no dupes) — TS can't enforce this", () => {
    expect([...OUTCOME_ORDER].sort()).toEqual(Object.keys(OUTCOME_LABELS).sort());
    expect(new Set(OUTCOME_ORDER).size).toBe(OUTCOME_ORDER.length); // no duplicates
  });
});
