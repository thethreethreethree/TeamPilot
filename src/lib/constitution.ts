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
   *  the existing per-amendment minor-bump convention (AMD-004=1.4 → AMD-006=1.6 → AMD-008=1.8
   *  → AMD-010=1.10 → AMD-011=1.11 → AMD-012=1.12 → AMD-013=1.13); AMD-007 and AMD-009 are PROPOSED, not
   *  ratified, so they are not counted — hence count 11 (001–006 + 008 + 010 + 011 + 012 + 013) with
   *  lastAmendmentId AMD-013 (the gaps at 007/009 are intentional). Updated 2026-08-22 on AMD-013. */
  version: "1.13",
  amendmentCount: 11,
  lastAmendmentDate: "2026-08-22",
  lastAmendmentId: "AMD-013",
  lastAmendmentTitle:
    "Every founder-decision is a picker, enforced by a Stop-hook gate",
} as const;

export type Constitution = typeof CONSTITUTION;
