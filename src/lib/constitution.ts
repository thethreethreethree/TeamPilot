/**
 * Constitution version metadata.
 *
 * Bumped whenever a new amendment is ratified. The UI surfaces this so customers
 * can see which version of CLAUDE.md governs their account, and so audits can
 * be associated with a specific constitution version.
 */
export const CONSTITUTION = {
  /** Major.Minor — major bumps on §-level structural change; minor bumps per amendment. */
  version: "1.4",
  amendmentCount: 4,
  lastAmendmentDate: "2026-06-02",
  lastAmendmentId: "AMD-004",
  lastAmendmentTitle: "Ground-up audit as a constitutional practice",
} as const;

export type Constitution = typeof CONSTITUTION;
