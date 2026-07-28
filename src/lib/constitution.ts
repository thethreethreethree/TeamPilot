/**
 * Constitution version metadata.
 *
 * Bumped whenever a new amendment is ratified. The UI surfaces this so customers
 * can see which version of the constitution governs their account, and so audits
 * can be associated with a specific constitution version.
 */
export const CONSTITUTION = {
  /** Major.Minor — major bumps on §-level structural change; minor bumps per amendment.
   *  Corrected 2026-07-28: metadata was stale at AMD-004 while AMD-005 + AMD-006 were
   *  already ratified (docs/amendments/), so /api/health + the customer-facing version
   *  badge reported a constitution state that wasn't true (§5 honesty). Version follows
   *  the existing per-amendment minor-bump convention (AMD-004=1.4 → AMD-006=1.6 → AMD-008=1.8);
   *  AMD-007 is PROPOSED, not ratified, so it is not counted — hence count 7 (001–006 + 008)
   *  with lastAmendmentId AMD-008 (the gap at 007 is intentional). Updated 2026-07-28 on AMD-008. */
  version: "1.8",
  amendmentCount: 7,
  lastAmendmentDate: "2026-07-28",
  lastAmendmentId: "AMD-008",
  lastAmendmentTitle:
    "The automatic build protocol (THINK · BUILD · CHECK) becomes mandatory",
} as const;

export type Constitution = typeof CONSTITUTION;
