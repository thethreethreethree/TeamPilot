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
   *  → AMD-010=1.10 → AMD-011=1.11); AMD-007 and AMD-009 are PROPOSED, not ratified, so they are not counted —
   *  hence count 9 (001–006 + 008 + 010 + 011) with lastAmendmentId AMD-011 (the gaps at 007/009 are
   *  intentional). Updated 2026-08-14 on AMD-011. */
  version: "1.11",
  amendmentCount: 9,
  lastAmendmentDate: "2026-08-14",
  lastAmendmentId: "AMD-011",
  lastAmendmentTitle:
    "A config-dependent feature is not complete until its external-config precondition is verified or flagged",
} as const;

export type Constitution = typeof CONSTITUTION;
