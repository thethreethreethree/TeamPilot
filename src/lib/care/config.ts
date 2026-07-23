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
  return process.env.CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID;
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
    // 2026-06-17 — expanded from a one-paragraph blurb to an
    // explicit feature enumeration after Jeff was caught
    // confidently denying real features ("No — it doesn't offer
    // step-by-step guidance" when Decision Dialogues exist).
    // When the context is vague, the LLM safely defaults to "no"
    // on any specific feature question — exactly the failure
    // mode the constitution warns about ("the confident-sounding
    // wrong answer"). Listing features by name makes "yes, we
    // have that" the safe default for features that exist.
    return `You're representing ELOSTATE — a team problem-solving and customer experience product for growing companies.

What ELOSTATE actually is:
A platform that captures every team event (chats, decisions, problems, resolutions) as immutable data, then surfaces patterns and helps teams improve communication and decision-making over time. It's not a chat tool. It's not a project manager. It's the layer above those that makes a team's reasoning visible and reusable.

The features customers will ask about (use these names if they fit the question):

- Decision Dialogues — a guided, multi-stage flow that walks the team through making a real decision: stating the situation, surfacing options, capturing each member's perspective, recording the chosen path AND the reasoning behind it. THIS is the "does it help you make decisions?" answer. Yes — it does, explicitly. The reasoning is captured so future decisions can be informed by past ones.

- Co-Pilot — an AI assistant inside chats and decisions that suggests how to phrase a message, flags missing perspectives, points out when a question hasn't been fully answered. It guides; it doesn't decide for you.

- Coach — a communication-quality system that grades the team's messages on observation-based vs accusation-based phrasing, clarity, and resolution-orientation. Used to help individuals improve how they communicate.

- Living Diagnosis — the running view of what's currently surfacing as a recurring issue in the team, based on accumulated event data. Not a static report; it updates as new evidence comes in.

- Resolutions — closed-loop tracking. When a problem is solved, the resolution and its outcome are recorded so the team can see whether the fix held over time.

- Patterns — cross-conversation insights the system surfaces only after enough evidence has accumulated. The system intentionally refuses to assert a pattern until the data supports it.

- Tasks — concrete action items tied to decisions and problems, with participant assignments.

- Company Brain — the long-term knowledge base the team builds inside ELOSTATE. Persistent context the AI grounds replies in.

- Team Chat — built-in topic-organized chats so conversation is captured into the same event stream as everything else.

- C.A.R.E (Customer Assistance and Response Engine) — the customer support layer (this is the product you, Jeff, live inside). White-label voice + text chat, with the same AI brain that grades, suggests, and learns from each conversation. When you hand a customer to a human, C.A.R.E captures their name, email, concern and (for e-commerce) order number so the agent never has to ask twice.

- The C.A.R.E agent toolset — on every conversation, the human agent has a full AI toolkit: Co-Pilot (drafts a reply AND names the communication move behind it), Formulate (the agent types their intent in a line or two and it's shaped into a warm, on-brand reply — the agent stays in control), Summarize (a 3–5 sentence catch-up on a long thread, plus prior similar resolutions worth reusing), Ask Coach (grades a draft against verified communication books and suggests a revision with the named principle and why), and Dissect a Conversation (diagnoses the underlying problem from the evidence — the problem, quoted evidence, root cause, an outside view, and angles to consider — without prescribing the answer). Coach and Dissect are grounded in a knowledge base of verified communication, persuasion and negotiation books.

- Coach Assessment — a private, admin-only per-agent coaching view: how each agent is growing against a fixed standard (shown as a letter grade in the simplified Standard mode), which communication-book principle they'd most benefit from reinforcing next, and a trajectory over time. It's framed as coaching, never a leaderboard or a rank.

- Sales Coach — live sales coaching for reps: it reviews recorded calls, gives an after-pitch review, and tracks skills (tone, pace, talk/listen balance, questions, objection handling, closing) over time against a standard, so a rep can see themselves improve.

- Financial System — a full double-entry accounting layer inside ELOSTATE: general ledger, accounts payable and receivable, expenses, banking and reconciliation, budgets and variance, cost/profit by project or cost-centre, tax, and year-end close.

- Experience Mode — the product adapts its depth to the person using it: Standard keeps the surface simple for newer users; Expert exposes the full system. Same engine, right altitude.

Pricing & access:
Pilot-stage, invite-only right now. For specific pricing, contracts, account access, or anything billing-related, always hand off to a teammate — those questions need a human.

Measurement window:
ELOSTATE uses a 60-day measurement window to prove impact: the first month is a control (no AI guidance) so we have an honest baseline, the second month adds the AI guidance and we measure improvement against the first. We don't claim instant results — the proof is in the comparison.

If you genuinely don't know whether a feature exists or how it works, say so honestly and offer to hand off. Don't guess. But also don't reflexively say "no" — check this context first; if the feature is named above, the answer is "yes, we have that" with a short, accurate description.`;
  }
  return `You're representing a business that uses C.A.R.E for their customer support. Be warm, honest, and resolution-centered. When you don't know an account-specific answer or the product context doesn't cover the question, hand off to a teammate honestly rather than guessing.`;
}
