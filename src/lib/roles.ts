/**
 * Role vocabulary — the SINGLE source of truth (§A13 vocabulary-once).
 *
 * Before this module the role space was authored in ≥4 incompatible places
 * (audit 2026-07-10, finding F4): the invite flow's local `ROLES`, auth-helpers'
 * `ADMIN_ROLES`, the onboarding RPC's `'admin'`, and inline `role === 'CEO' ||
 * 'COO' || 'admin'` at ~20 gates. This module authors each set ONCE, by category,
 * so a change happens in one place. It is deliberately NOT `server-only` — both
 * server routes AND client components (e.g. the invite-role dropdown + its hint
 * copy) must consume the same set, which is exactly the A13 point.
 *
 * Two distinct axes (do not conflate — they are different questions):
 *   - INVITABLE_ROLES: what a team invite may assign (team_invitations.role,
 *     0008 CHECK). The founder is created as 'admin' by onboarding (0046/0047),
 *     which is NOT invitable — an invited admin is 'CEO'/'COO'. That asymmetry is
 *     pre-existing and intentional (you can't invite someone as the lowercase
 *     'admin' onboarding role); documented here rather than silently unified.
 *   - ADMIN_ROLES: which role values grant company-admin authority. Covers BOTH
 *     the onboarding 'admin' AND the invitable 'CEO'/'COO'.
 */

/** Roles a team invitation may assign. Mirrors the 0008 CHECK constraint exactly. */
export const INVITABLE_ROLES = ["CEO", "COO", "Lead", "Member"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** The company-admin (leadership) role set. 'admin' = the onboarding founder role
 *  (0046/0047); 'CEO'/'COO' = the invitable admin roles. 'Lead'/'Member' are NOT
 *  admin. Exact match — no accidental broadening ("administrator" is NOT admin). */
export const ADMIN_ROLES = ["CEO", "COO", "admin"] as const;

/** True iff the role is a company-admin (leadership) role. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && (ADMIN_ROLES as readonly string[]).includes(role);
}

/** True iff a string is a valid invitable role. Use to validate invite input. */
export function isInvitableRole(role: unknown): role is InvitableRole {
  return (
    typeof role === "string" && (INVITABLE_ROLES as readonly string[]).includes(role)
  );
}
