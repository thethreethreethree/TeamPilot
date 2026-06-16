/**
 * ELOSTATE Care — server-side tenant resolution.
 *
 * For the internal Care surface (the widget on elostate.com), every
 * conversation is scoped to ELOSTATE's own company_id. This default
 * is set via CARE_DEFAULT_TENANT_ID env var so prod and dev can
 * point at different tenants if needed; falls back to ELOSTATE's
 * live id so the widget keeps working without explicit config.
 *
 * For the future white-label widget (Sprint 3), this resolver will
 * also accept an embed token from the embedding business's snippet
 * and look up THEIR company_id — that's why the function shape
 * takes a request hint rather than hard-returning a literal.
 */

const ELOSTATE_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";

/**
 * Pick the tenant a customer-side conversation should land under.
 * For Sprint 1: always the default tenant (ELOSTATE). Sprint 3 will
 * extend this to look up white-label tenants from an embed token.
 */
export function resolveCareTenant(_hint?: {
  origin?: string;
  embedToken?: string;
}): string {
  // CARE_DEFAULT_TENANT_ID is the env override — useful for staging
  // builds pointing at a different Supabase project. Production
  // falls through to ELOSTATE's live id.
  return process.env.CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID;
}

/**
 * Per-tenant product context the AI grounds in. For Sprint 1 this
 * is hardcoded for ELOSTATE; Sprint 3 will read it from a
 * support_tenants config table populated when a white-label
 * customer signs up.
 */
export function getProductContextForTenant(tenantId: string): string {
  if (tenantId === ELOSTATE_COMPANY_ID) {
    return `You're representing ELOSTATE — a team problem-solving product for growing companies. The product helps teams diagnose recurring issues, capture decision reasoning, and improve communication over time. Customers typically ask about: how it works, pricing (pilot-stage, invite only right now), the measurement window we use to prove impact, security and data handling, integration with other tools, and onboarding. For specifics about pricing, contract terms, or anything account-related, hand off to a teammate — those questions need a human.`;
  }
  // Default fallback — generic product context.
  return `You're representing a business that signed up to use ELOSTATE's customer chat. Be helpful and honest about general product questions; hand off to a human for anything account-specific or that needs internal knowledge you don't have.`;
}
