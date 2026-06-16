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

const ELOSTATE_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";

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
  plan: "pilot" | "starter" | "pro" | "enterprise";
  monthlyConversationQuota: number;
};

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
    plan: (row.plan as CareTenantConfig["plan"]) ?? "pilot",
    monthlyConversationQuota:
      (row.monthly_conversation_quota as number) ?? 200,
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
  return process.env.CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID;
}

/**
 * Resolve a tenant from embed token + origin. Validates active
 * status + allowed origins. Logs the load event regardless of
 * outcome so tenants see traffic and we see wrong-origin attempts.
 */
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
  const origin = args.origin ?? "";
  const allows = config.allowedOrigins;
  const matched =
    allows.includes(origin) ||
    (process.env.NODE_ENV !== "production" && allows.includes("*"));
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
 * Per-tenant product context the AI grounds in. Reads the
 * configured ai_product_context first; falls back to the
 * hardcoded ELOSTATE context for the default tenant; falls back
 * to a generic "be honest, hand off when unsure" prompt when no
 * config exists.
 */
export async function getProductContextForTenant(
  tenantId: string
): Promise<string> {
  const config = await getCareTenantConfigByCompanyId(tenantId);
  if (config?.aiProductContext) {
    return config.aiProductContext;
  }
  if (tenantId === ELOSTATE_COMPANY_ID) {
    return `You're representing ELOSTATE — a team problem-solving and customer experience product for growing companies. The product helps teams diagnose recurring issues, capture decision reasoning, and improve communication over time. Customers typically ask about: how it works, pricing (pilot-stage, invite only right now), the measurement window we use to prove impact, security and data handling, integration with other tools, and onboarding. For specifics about pricing, contract terms, or anything account-related, hand off to a teammate — those questions need a human.`;
  }
  return `You're representing a business that uses C.A.R.E for their customer support. Be warm, honest, and resolution-centered. When you don't know an account-specific answer or the product context doesn't cover the question, hand off to a teammate honestly rather than guessing.`;
}
