import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function requireCompanyAdmin() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (
    !profile?.company_id ||
    !(
      profile.role === "CEO" ||
      profile.role === "COO" ||
      profile.role === "admin"
    )
  ) {
    return { error: "Company admin only.", status: 403 } as const;
  }
  return { companyId: profile.company_id };
}

export async function GET() {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
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
  widgetLogoUrl: z.string().url().max(2000).optional().nullable(),
  companyDisplayName: z.string().max(200).optional().nullable(),
  replySignature: z.string().max(400).optional().nullable(),
  aiProductContext: z.string().max(8000).optional().nullable(),
  aiTone: z.enum(["warm", "formal", "casual", "direct"]).optional(),
  aiResponseLength: z.enum(["short", "medium", "long"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
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
  if (body.widgetLogoUrl !== undefined) patch.widget_logo_url = body.widgetLogoUrl;
  if (body.companyDisplayName !== undefined)
    patch.company_display_name = body.companyDisplayName;
  if (body.replySignature !== undefined) patch.reply_signature = body.replySignature;
  if (body.aiProductContext !== undefined)
    patch.ai_product_context = body.aiProductContext;
  if (body.aiTone !== undefined) patch.ai_tone = body.aiTone;
  if (body.aiResponseLength !== undefined)
    patch.ai_response_length = body.aiResponseLength;

  const admin = createAdminClient();
  // Ensure a row exists (upsert by company_id).
  const { data } = await admin
    .from("care_tenant_config")
    .upsert({ company_id: ctx.companyId, ...patch }, { onConflict: "company_id" })
    .select("*")
    .single();
  return NextResponse.json({ config: data });
}
