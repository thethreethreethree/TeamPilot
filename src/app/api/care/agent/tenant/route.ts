import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/tenant
 *
 * Returns the calling user's company tenant config. Includes the
 * embed_token + allowed_origins + plan/quota fields that are
 * NEVER exposed publicly via the bootstrap endpoint.
 *
 * PATCH /api/care/agent/tenant
 *
 * Update widget appearance, AI personality, allowed origins,
 * branding. Company admins only (CEO / COO / admin). Embed token
 * is regenerable but not editable directly — POST a separate
 * action for rotation.
 */

// Local requireCompanyAdmin replaced by the shared
// requireCareAgent helper + admin role check at the call site.
// Same effective gate; consistent shape across routes.

export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.isAdmin || !auth.companyId) {
    return NextResponse.json(
      { error: "Company admin only." },
      { status: 403 }
    );
  }
  const ctx = { companyId: auth.companyId };
  const admin = createAdminClient();
  // Upsert-then-read so two concurrent first-loads (e.g. CEO and
  // COO opening the settings page at the same moment) can't race
  // into a unique-constraint 500. ignoreDuplicates means the
  // existing row wins; the follow-up select returns whichever
  // landed first.
  await admin
    .from("care_tenant_config")
    .upsert(
      { company_id: ctx.companyId },
      { onConflict: "company_id", ignoreDuplicates: true }
    );
  const { data } = await admin
    .from("care_tenant_config")
    .select("*")
    .eq("company_id", ctx.companyId)
    .single();
  // Derive the full inbound email address from the tenant's
  // local part + the deployment-level host domain. The host
  // domain isn't a tenant-config column because it's the same
  // for every tenant on this deployment (set once in env).
  const emailHostDomain = process.env.CARE_EMAIL_HOST_DOMAIN ?? null;
  const inboundEmailAddress =
    data?.inbound_email_local_part && emailHostDomain
      ? `${data.inbound_email_local_part}@${emailHostDomain}`
      : null;
  return NextResponse.json({
    config: data,
    inboundEmailAddress,
    emailHostDomain,
  });
}

const PatchBody = z.object({
  allowedOrigins: z.array(z.string().min(1).max(400)).max(50).optional(),
  active: z.boolean().optional(),
  widgetColor: z.string().min(1).max(20).optional(),
  widgetGreeting: z.string().min(1).max(200).optional(),
  widgetSubtitle: z.string().min(1).max(200).optional(),
  widgetPosition: z.enum(["bottom-right", "bottom-left"]).optional(),
  // widgetLogoUrl is INTENTIONALLY NOT accepted via PATCH — per
  // the 2026-06-20 pre-ship audit Persona 3 finding, allowing
  // arbitrary URLs here would let an admin bypass the
  // /api/care/agent/tenant/logo upload endpoint's image-type check
  // and point the customer-facing widget at any external URL
  // (phishing surface, tracking pixels, malicious SVG). The logo
  // can ONLY be set via the dedicated upload endpoint, which
  // writes to our widget-logos bucket and stores the public URL.
  // Use DELETE /api/care/agent/tenant/logo to clear.
  companyDisplayName: z.string().max(200).optional().nullable(),
  replySignature: z.string().max(400).optional().nullable(),
  aiProductContext: z.string().max(8000).optional().nullable(),
  aiTone: z.enum(["warm", "formal", "casual", "direct"]).optional(),
  aiResponseLength: z.enum(["short", "medium", "long"]).optional(),
  // Per-tenant agent name (migration 0064). Sanitized via Zod
  // refine to strip control characters BEFORE the DB layer's
  // CHECK constraint sees it — defense in depth against the
  // prompt-injection vector named in the 2026-06-20 pre-ship
  // audit. The refine returns the cleaned string; the CHECK
  // constraint at the DB rejects anything that slips through.
  aiName: z
    .string()
    .min(1)
    .max(50)
    // Strip dangerous Unicode classes (defense in depth against
    // prompt injection into the LLM system prompt). Per the
    // 2026-06-24 audit (H1): the old [\x00-\x1F\x7F] range missed
    // U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR, the C1
    // controls (U+0080-U+009F), and zero-width chars — all of
    // which can break a name across lines or obfuscate inside an
    // LLM prompt. \p{C} = control+format+unassigned+surrogate+
    // private-use; \p{Zl} = line separator; \p{Zp} = paragraph
    // separator. Legitimate names (emoji, accents, CJK, Arabic,
    // normal U+0020 spaces) are all preserved. DB CHECK is the
    // backstop (migration 0066).
    .transform((s) => s.replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "").trim())
    .refine((s) => s.length >= 1 && s.length <= 50, {
      message: "Agent name must be 1-50 printable characters.",
    })
    .optional(),
  // Phase 9 voice — ElevenLabs voice ID. Freeform text rather
  // than enum so tenants can use any voice from the ElevenLabs
  // library (the settings UI surfaces a curated picker but
  // accepts overrides). NULL → use deployment default (Antoni).
  voiceId: z.string().max(64).optional().nullable(),
  // Handover capture (0188) — the business type that drives the concern-topic list on
  // the customer handoff card and whether the order-number field appears.
  businessType: z.enum(["general", "ecommerce"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.isAdmin || !auth.companyId) {
    return NextResponse.json(
      { error: "Company admin only." },
      { status: 403 }
    );
  }
  const ctx = { companyId: auth.companyId };
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

  // Map camelCase → snake_case for the DB columns.
  const patch: Record<string, unknown> = {};
  if (body.allowedOrigins !== undefined) patch.allowed_origins = body.allowedOrigins;
  if (body.active !== undefined) patch.active = body.active;
  if (body.widgetColor !== undefined) patch.widget_color = body.widgetColor;
  if (body.widgetGreeting !== undefined) patch.widget_greeting = body.widgetGreeting;
  if (body.widgetSubtitle !== undefined) patch.widget_subtitle = body.widgetSubtitle;
  if (body.widgetPosition !== undefined) patch.widget_position = body.widgetPosition;
  // widget_logo_url intentionally not mapped — set via the
  // dedicated /api/care/agent/tenant/logo upload endpoint only.
  if (body.companyDisplayName !== undefined)
    patch.company_display_name = body.companyDisplayName;
  if (body.replySignature !== undefined) patch.reply_signature = body.replySignature;
  if (body.aiProductContext !== undefined)
    patch.ai_product_context = body.aiProductContext;
  if (body.aiTone !== undefined) patch.ai_tone = body.aiTone;
  if (body.aiResponseLength !== undefined)
    patch.ai_response_length = body.aiResponseLength;
  if (body.aiName !== undefined) patch.ai_name = body.aiName;
  if (body.voiceId !== undefined) patch.voice_id = body.voiceId;
  if (body.businessType !== undefined) patch.business_type = body.businessType;

  const admin = createAdminClient();
  // Ensure a row exists (upsert by company_id).
  const { data } = await admin
    .from("care_tenant_config")
    .upsert({ company_id: ctx.companyId, ...patch }, { onConflict: "company_id" })
    .select("*")
    .single();
  return NextResponse.json({ config: data });
}
