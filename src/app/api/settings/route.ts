import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

// Per TT.md A21 audit (2026-06-18) HIGH finding — until this fix the
// PATCH handler used a manual `for ... if (body[f] !== undefined)` loop
// against this ALLOWED_FIELDS list. The check rejected extras but didn't
// validate types or bounds — a caller could set `name: 42` or
// `timezone: "..."*10kb` and it would land in companies. Replaced with
// a zod schema that types AND bounds each field.
const ALLOWED_FIELDS = [
  "name",
  "industry",
  "size",
  "stage",
  "goals",
  "timezone",
  "llm_provider_preference",
] as const;

// 2026-06-18 fix: original schema rejected null and used wrong type
// for goals. The Settings page sends `field || null` for every
// optional text field, which means cleared inputs hit the API as
// null — and the schema's `.optional()` only accepts undefined, not
// null. Also `goals` is stored as a string[] in the DB (jsonb), not
// a string. Both shapes corrected. .strict() retained so unknown
// fields still get rejected — that's the security hygiene the
// original Zod fix was meant to add.
const SettingsPatchSchema = z
  .object({
    name: z.string().max(200).nullable().optional(),
    industry: z.string().max(120).nullable().optional(),
    size: z.string().max(40).nullable().optional(),
    stage: z.string().max(80).nullable().optional(),
    goals: z.array(z.string().max(200)).max(40).nullable().optional(),
    timezone: z.string().max(80).optional(),
    llm_provider_preference: z
      .enum(["deepseek", "anthropic"])
      .nullable()
      .optional(),
  })
  .strict();

/**
 * GET  /api/settings — returns the current company's settings + active LLM provider
 * PATCH /api/settings — updates the allowlisted fields above
 *
 * The UI uses these to render the Settings page. There is no separate
 * `settings` table — settings ARE the company row (per migration 0009).
 */

export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Live mode required." },
      { status: 400 }
    );
  }
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, industry, size, stage, goals, timezone, llm_provider_preference, ai_guidance_enabled, ai_guidance_unlock_at, ai_guidance_enabled_at, updated_at"
    )
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[settings GET] failed to load company:", error);
    return NextResponse.json(
      { error: "Couldn't load settings." },
      { status: 500 }
    );
  }

  // Report which provider is actually active right now — independent of stored
  // preference, since the env may not have a key for the preferred provider.
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  let activeProvider: string | null = null;
  let activeReason = "";
  if (envProvider === "deepseek") {
    activeProvider = hasDeepseek ? "deepseek" : null;
    activeReason = hasDeepseek
      ? "LLM_PROVIDER=deepseek"
      : "LLM_PROVIDER=deepseek but DEEPSEEK_API_KEY missing";
  } else if (envProvider === "anthropic") {
    activeProvider = hasAnthropic ? "anthropic" : null;
    activeReason = hasAnthropic
      ? "LLM_PROVIDER=anthropic"
      : "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY missing";
  } else if (hasDeepseek) {
    activeProvider = "deepseek";
    activeReason = "DEEPSEEK_API_KEY present (primary per AMD-003)";
  } else if (hasAnthropic) {
    activeProvider = "anthropic";
    activeReason = "ANTHROPIC_API_KEY present (alternate)";
  } else {
    activeReason = "no LLM provider key configured";
  }

  return NextResponse.json({
    company: data,
    llm: {
      preference: data.llm_provider_preference,
      activeProvider,
      activeReason,
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Live mode required." },
      { status: 400 }
    );
  }
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  const body = await readBody(req, SettingsPatchSchema);
  if (body instanceof NextResponse) return body;
  const patch: Record<string, unknown> = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] !== undefined) patch[f] = body[f];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No mutable fields provided." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", companyId);
  if (error) {
    console.error("[settings PATCH] failed to save settings:", error);
    return NextResponse.json({ error: "Couldn't save settings." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
