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

/** The company-admin (leadership) role set = the C-Suite tier. 'admin' = the onboarding founder role (0046/0047);
 *  'CEO'/'CFO'/'COO' = the C-Suite roles. 'CFO' added 2026-08-29 with the org hierarchy (founder: C-Suite = admin) —
 *  a new value, so no existing user's authority changes. VP/Director/Manager/Supervisor/Lead/Member are NOT admin.
 *  Exact match — no accidental broadening ("administrator" is NOT admin). */
export const ADMIN_ROLES = ["CEO", "CFO", "COO", "admin"] as const;

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

/**
 * Org hierarchy (founder 2026-08-29) — the canonical top-to-bottom order for DISPLAYING team members across all of
 * Elostate. This is the ORGANIZATION axis (who sits where in the org chart), distinct from ADMIN_ROLES (the
 * authority axis) — a Director isn't an admin, but ranks above a Manager. The role VALUES stay granular (CEO vs
 * COO); the RANK groups them into the six tiers below for ordering. Every team roster sorts by this, so the org
 * reads the same everywhere. One definition, consumed by reference (§A13).
 *
 * The six tiers, top to bottom: C-Suite (CEO/CFO/COO + the onboarding 'admin') · VP · Director · Manager ·
 * Supervisor/Team Lead (incl. the invitable 'Lead') · Frontline (incl. 'Member' and the sales-coach 'staff').
 * VP/Director/Manager/Supervisor/CFO are not assignable yet — added with the assignment UI — but the rank already
 * places them correctly the moment they exist.
 */
export const ORG_TIERS = [
  "C-Suite",
  "VP",
  "Director",
  "Manager",
  "Supervisor / Team Lead",
  "Frontline",
] as const;
export type OrgTier = (typeof ORG_TIERS)[number];

// role value (lowercased) → tier index (0 = top). Case-insensitive so the 'Member'/'member' casing split both map
// to Frontline. A role not listed — or null — ranks BELOW Frontline (unassigned sinks to the bottom of the roster).
const ROLE_TIER: Record<string, number> = {
  admin: 0, ceo: 0, cfo: 0, coo: 0, // C-Suite
  vp: 1, // VP
  director: 2, // Director
  manager: 3, // Manager
  supervisor: 4, lead: 4, "team lead": 4, // Supervisor / Team Lead
  member: 5, staff: 5, // Frontline
};

/** The org rank of a role: 0 (C-Suite) … 5 (Frontline), and ORG_TIERS.length (6) for unknown/null (sorts last). */
export function orgRoleRank(role: string | null | undefined): number {
  if (role == null) return ORG_TIERS.length;
  const t = ROLE_TIER[role.trim().toLowerCase()];
  return t === undefined ? ORG_TIERS.length : t;
}

/** The tier label a role belongs to (for grouping headers). "Unassigned" for an unknown/null role. */
export function orgTierLabel(role: string | null | undefined): string {
  return ORG_TIERS[orgRoleRank(role)] ?? "Unassigned";
}

/**
 * A comparator that orders team members TOP-TO-BOTTOM by org rank, then A→Z by name (case-insensitive) within a
 * tier. Pass accessors for the role and the display name. Use as `list.sort(byOrgRank(m => m.role, m => m.name))`.
 */
export function byOrgRank<T>(
  getRole: (t: T) => string | null | undefined,
  getName: (t: T) => string | null | undefined
): (a: T, b: T) => number {
  return (a, b) =>
    orgRoleRank(getRole(a)) - orgRoleRank(getRole(b)) ||
    (getName(a) ?? "").localeCompare(getName(b) ?? "", undefined, { sensitivity: "base" });
}

/**
 * The org roles an admin may ASSIGN to a team member (stage 2, founder 2026-08-29), grouped by tier for the
 * assignment dropdown. C-Suite is admin authority (ADMIN_ROLES); the rest are not. The onboarding 'admin' bootstrap
 * role isn't offered (it maps to C-Suite for display + ranking, and re-assigning a founder to 'CEO' keeps them
 * admin). 'Supervisor' is the assignable Supervisor/Team-Lead value; the legacy invitable 'Lead' still ranks there.
 */
export const ORG_ROLE_OPTIONS = [
  { role: "CEO", tier: "C-Suite" },
  { role: "CFO", tier: "C-Suite" },
  { role: "COO", tier: "C-Suite" },
  { role: "VP", tier: "VP" },
  { role: "Director", tier: "Director" },
  { role: "Manager", tier: "Manager" },
  { role: "Supervisor", tier: "Supervisor / Team Lead" },
  { role: "Member", tier: "Frontline" },
] as const;

/** The set of role values an admin may assign (validation for the set-role route). */
export const ASSIGNABLE_ORG_ROLES = ORG_ROLE_OPTIONS.map((o) => o.role);
export type AssignableOrgRole = (typeof ORG_ROLE_OPTIONS)[number]["role"];

/** True iff a string is an assignable org role. Reject anything else at the set-role route boundary. */
export function isAssignableOrgRole(role: unknown): role is AssignableOrgRole {
  return typeof role === "string" && (ASSIGNABLE_ORG_ROLES as readonly string[]).includes(role);
}
