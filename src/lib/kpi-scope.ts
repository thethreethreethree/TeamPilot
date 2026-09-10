/**
 * Which figures a KPI board opens on.
 *
 * WHY A MANAGER SHOULD NOT OPEN ON THEIR OWN NUMBERS. The website changed this
 * deliberately (founder, 2026-08-29) and wrote down why: a per-rep view "stays
 * 'building' for a long time because outcomes are sparse per rep, but pooled
 * across the business the objective numbers show today". So a manager opening
 * their own figures sees mostly blanks, while the company view has real numbers
 * in it. The phone was opening every viewer on `self`, including managers.
 *
 * HOW THIS DIFFERS FROM THE WEBSITE, AND WHY IT IS BETTER HERE. The website
 * discovers that the viewer is a manager by CALLING the team endpoint and
 * seeing whether it 403s. On a phone that is a request whose only purpose, for
 * the great majority of users, is to be refused — the KPI screen's own note
 * rejects paying for that. This app already holds the viewer's company role in
 * a cache it fetched for other screens, so it can reach the same answer with no
 * request at all.
 *
 * ANYTHING UNKNOWN OPENS ON `self`. A role that could not be read is not a
 * manager: asking for company figures the account cannot see wastes the call the
 * paragraph above exists to avoid, and the route would refuse it anyway.
 */

/** The company roles that may see whole-company figures. Mirrors the web's ADMIN_ROLES. */
export const COMPANY_SCOPE_ROLES = ['CEO', 'CFO', 'COO', 'admin'] as const;

export type KpiScope = 'self' | 'company';

export function openingScope(companyRole: string | null | undefined): KpiScope {
  if (!companyRole) return 'self';
  return (COMPANY_SCOPE_ROLES as readonly string[]).includes(companyRole) ? 'company' : 'self';
}
