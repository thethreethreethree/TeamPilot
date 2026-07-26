/**
 * C.A.R.E — Customer Assistance and Response Engine.
 * Server-side tenant resolution + per-tenant config loader.
 *
 * Two modes:
 *   - Direct (no embed token): widget loads on ELOSTATE itself;
 *     falls back to the default tenant id from env / hardcode.
 *   - Embedded (with embed token + origin): widget loads on a
 *     white-label tenant's site; we resolve the tenant from the
 *     embed token, validate the origin against allowed_origins,
 *     and scope conversations to that company_id.
 *
 * The validation outcome is logged to care_widget_load_events so
 * tenants and we can see traffic + wrong-origin attempts.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { type BusinessType, isBusinessType, DEFAULT_BUSINESS_TYPE } from "@/lib/care/handoverTopics";
import { ELOSTATE_PRODUCT_KNOWLEDGE } from "@/lib/care/elostateProductKnowledge";

const ELOSTATE_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";

/**
 * The deployment's OWN (ELOSTATE) tenant id — the one the direct/no-embed widget, the demo, and
 * elostate.com resolve to. MUST match resolveCareTenant()'s logic: an env override wins over the
 * hardcoded constant. This was a real bug: the code-managed knowledge check keyed on the hardcoded
 * constant while callers pass resolveCareTenant()'s result — so if CARE_DEFAULT_TENANT_ID is set to
 * a different id, the authoritative product knowledge was never served (Jeff falls back to generic).
 */
function ownTenantId(): string {
  return process.env.CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID;
}

/**
 * Whether a tenant's product context is AUTHORITATIVELY maintained in code
 * (ELOSTATE_PRODUCT_KNOWLEDGE) rather than from the editable `ai_product_context`
 * config. This is the SAME predicate getProductContextForTenant uses to decide the
 * ELOSTATE branch — exported so the settings UI can tell the founder that editing the
 * "Product context" field has no effect for this tenant, instead of the edit silently
 * doing nothing (an A31/A14 dead-control). Keep this and getProductContextForTenant's
 * ELOSTATE check in agreement — they are the same rule and must not drift.
 */
export function isProductContextCodeManaged(companyId: string): boolean {
  return companyId === ownTenantId();
}

export type CareTenantResolution =
  | {
      ok: true;
      companyId: string;
      config: CareTenantConfig;
    }
  | {
      ok: false;
      reason:
        | "origin_rejected"
        | "tenant_inactive"
        | "tenant_unknown"
        | "quota_exceeded";
    };

export type CareTenantConfig = {
  companyId: string;
  allowedOrigins: string[];
  active: boolean;
  widgetColor: string;
  widgetGreeting: string;
  widgetSubtitle: string;
  widgetPosition: "bottom-right" | "bottom-left";
  widgetLogoUrl: string | null;
  companyDisplayName: string | null;
  replySignature: string | null;
  aiProductContext: string | null;
  aiTone: "warm" | "formal" | "casual" | "direct";
  aiResponseLength: "short" | "medium" | "long";
  /** Per-tenant name for the customer-facing AI agent. Default 'Jeff'.
   *  Constrained at the DB layer (migration 0064) to 1-50 chars and
   *  no control characters as defense against prompt injection into
   *  the LLM system prompt. */
  aiName: string;
  plan: "pilot" | "starter" | "pro" | "enterprise";
  monthlyConversationQuota: number;
  /** Handover-capture business type (migration 0188). Drives which concern-topic list the widget shows
   *  and whether the order-number field appears. Defaults to 'general' — including when the column is not
   *  yet present (select("*") simply omits it pre-0188), so tenants behave exactly as before. */
  businessType: BusinessType;
};

/** The ONLY fields safe to expose on the PUBLIC widget bootstrap endpoint (no auth). */
export type WidgetSafeConfig = {
  color: string;
  greeting: string;
  subtitle: string;
  position: "bottom-right" | "bottom-left";
  logoUrl: string | null;
  displayName: string | null;
  aiName: string;
  businessType: BusinessType;
};

/**
 * Project a resolved tenant config down to the fields the public widget may see. This is an EXPLICIT
 * whitelist, never a spread — so internal fields (`allowedOrigins`, `plan`, `monthlyConversationQuota`,
 * `companyId`, `active`, `replySignature`, `aiProductContext`, `aiTone`, `aiResponseLength`, and any
 * `embed_token`) can NEVER leak to an unauthenticated caller, AND a NEW internal field added to
 * `CareTenantConfig` does not silently appear in the public response (the failure mode a spread creates).
 * `aiProductContext` in particular is a tenant's internal product playbook fed to the AI system prompt —
 * leaking it would hand a competitor that playbook. Locked by `config.widgetSafe.test.ts`.
 */
export function toWidgetSafeConfig(c: CareTenantConfig): WidgetSafeConfig {
  return {
    color: c.widgetColor,
    greeting: c.widgetGreeting,
    subtitle: c.widgetSubtitle,
    position: c.widgetPosition,
    logoUrl: c.widgetLogoUrl,
    displayName: c.companyDisplayName,
    aiName: c.aiName,
    businessType: c.businessType,
  };
}

function mapConfig(row: Record<string, unknown>): CareTenantConfig {
  return {
    companyId: row.company_id as string,
    allowedOrigins: (row.allowed_origins as string[]) ?? [],
    active: !!row.active,
    widgetColor: (row.widget_color as string) ?? "#FACC15",
    widgetGreeting: (row.widget_greeting as string) ?? "We're here to help",
    widgetSubtitle:
      (row.widget_subtitle as string) ?? "Typical reply: a few seconds",
    widgetPosition:
      (row.widget_position as CareTenantConfig["widgetPosition"]) ??
      "bottom-right",
    widgetLogoUrl: (row.widget_logo_url as string | null) ?? null,
    companyDisplayName: (row.company_display_name as string | null) ?? null,
    replySignature: (row.reply_signature as string | null) ?? null,
    aiProductContext: (row.ai_product_context as string | null) ?? null,
    aiTone: (row.ai_tone as CareTenantConfig["aiTone"]) ?? "warm",
    aiResponseLength:
      (row.ai_response_length as CareTenantConfig["aiResponseLength"]) ??
      "medium",
    aiName: (row.ai_name as string) ?? "Jeff",
    plan: (row.plan as CareTenantConfig["plan"]) ?? "pilot",
    monthlyConversationQuota:
      (row.monthly_conversation_quota as number) ?? 200,
    businessType: isBusinessType(row.business_type)
      ? row.business_type
      : DEFAULT_BUSINESS_TYPE,
  };
}

/**
 * Direct (no embed) tenant — used when the widget loads from our
 * own dashboard or marketing site. Always ELOSTATE.
 */
export function resolveCareTenant(_hint?: {
  origin?: string;
  embedToken?: string;
}): string {
  return ownTenantId(); // same resolution the product-knowledge check uses — they must not drift
}

/**
 * Resolve a tenant from embed token + origin. Validates active
 * status + allowed origins. Logs the load event regardless of
 * outcome so tenants see traffic and we see wrong-origin attempts.
 */
/**
 * Whether a widget request's Origin is allowed to embed this tenant's widget.
 * SECURITY INVARIANT (pinned by a test): an exact allowlist match is always
 * required; the wildcard "*" is honored ONLY in non-production (pilot/dev) — in
 * production there is no wildcard, an explicit origin match is mandatory. Pure +
 * exported so that invariant can't silently regress.
 */
export function isOriginAllowed(args: {
  origin: string;
  allowedOrigins: string[];
  isProduction: boolean;
}): boolean {
  if (args.allowedOrigins.includes(args.origin)) return true;
  if (!args.isProduction && args.allowedOrigins.includes("*")) return true;
  return false;
}

export async function resolveCareTenantByEmbedToken(args: {
  embedToken: string;
  origin: string | null;
  userAgent: string | null;
}): Promise<CareTenantResolution> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("care_tenant_config")
    .select("*")
    .eq("embed_token", args.embedToken)
    .maybeSingle();

  if (!row) {
    await logLoadEvent(admin, {
      companyId: null,
      embedToken: args.embedToken,
      origin: args.origin,
      userAgent: args.userAgent,
      result: "tenant_unknown",
    });
    return { ok: false, reason: "tenant_unknown" };
  }

  const config = mapConfig(row);

  if (!config.active) {
    await logLoadEvent(admin, {
      companyId: config.companyId,
      embedToken: args.embedToken,
      origin: args.origin,
      userAgent: args.userAgent,
      result: "tenant_inactive",
    });
    return { ok: false, reason: "tenant_inactive" };
  }

  // Origin validation — wildcard is only honored in non-production
  // (pilot / dev). In prod, an explicit match is required.
  const matched = isOriginAllowed({
    origin: args.origin ?? "",
    allowedOrigins: config.allowedOrigins,
    isProduction: process.env.NODE_ENV === "production",
  });
  if (!matched) {
    await logLoadEvent(admin, {
      companyId: config.companyId,
      embedToken: args.embedToken,
      origin: args.origin,
      userAgent: args.userAgent,
      result: "origin_rejected",
    });
    return { ok: false, reason: "origin_rejected" };
  }

  await logLoadEvent(admin, {
    companyId: config.companyId,
    embedToken: args.embedToken,
    origin: args.origin,
    userAgent: args.userAgent,
    result: "ok",
  });

  return { ok: true, companyId: config.companyId, config };
}

/**
 * Public log helper for quota-exceeded events. Called from the
 * conversations create route AFTER a successful tenant resolution
 * when the usage count blows past the configured quota. Same
 * shape as the bootstrap load events so the admin sees one
 * coherent stream of "what happened on the widget" rather than
 * two parallel logs.
 */
export async function logCareQuotaExceeded(args: {
  companyId: string;
  embedToken: string | null;
  origin: string | null;
  userAgent: string | null;
}): Promise<void> {
  await logLoadEvent(createAdminClient(), {
    companyId: args.companyId,
    embedToken: args.embedToken ?? "(internal)",
    origin: args.origin,
    userAgent: args.userAgent,
    result: "quota_exceeded",
  });
}

async function logLoadEvent(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    companyId: string | null;
    embedToken: string;
    origin: string | null;
    userAgent: string | null;
    result:
      | "ok"
      | "origin_rejected"
      | "tenant_inactive"
      | "tenant_unknown"
      | "quota_exceeded";
  }
): Promise<void> {
  try {
    await admin.from("care_widget_load_events").insert({
      company_id: args.companyId,
      embed_token: args.embedToken,
      origin: args.origin,
      result: args.result,
      user_agent: args.userAgent,
    });
  } catch {
    /* telemetry is best-effort */
  }
}

/**
 * Look up the config for a known company id (the dashboard's own
 * tenant settings page reads this).
 */
export async function getCareTenantConfigByCompanyId(
  companyId: string
): Promise<CareTenantConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("care_tenant_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  return mapConfig(data);
}

/**
 * Per-tenant product context the AI grounds in. Order matters:
 *   1. ELOSTATE (our own tenant) → the code-maintained
 *      ELOSTATE_PRODUCT_KNOWLEDGE, AUTHORITATIVE and checked FIRST so a
 *      stale DB config can never leave our own Jeff unable to describe
 *      our own product (the "what is C.A.R.E?" flaw). Maintained on
 *      every feature — see elostateProductKnowledge.ts.
 *   2. Any other tenant with a configured ai_product_context → that.
 *   3. Otherwise → a generic "be honest, hand off when unsure" prompt.
 */
export async function getProductContextForTenant(
  tenantId: string
): Promise<string> {
  // ELOSTATE's own Jeff: the code-maintained product knowledge is AUTHORITATIVE — checked
  // BEFORE the per-tenant aiProductContext override so a stale DB config can NEVER leave our
  // own AI unable to describe our own product. This is the fix for the launch-grade flaw where
  // Jeff answered "what is C.A.R.E?" with "I'm not familiar with that acronym" on our own
  // widget: the comprehensive knowledge lives in code (maintained on every feature) and can't
  // be silently defeated by a stale tenant config. Other tenants keep their configured context.
  if (tenantId === ownTenantId()) {
    return ELOSTATE_PRODUCT_KNOWLEDGE;
  }
  const config = await getCareTenantConfigByCompanyId(tenantId);
  if (config?.aiProductContext) {
    return config.aiProductContext;
  }
  return `You're representing a business that uses C.A.R.E for their customer support. Be warm, honest, and resolution-centered. When you don't know an account-specific answer or the product context doesn't cover the question, hand off to a teammate honestly rather than guessing.`;
}
