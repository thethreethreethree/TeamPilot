import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { CURATED_VOICES, DEFAULT_VOICE_ID } from "@/lib/care/voice/elevenlabs";

/**
 * Sales Coach → cue voice config (migration 0075).
 *
 * GET  → the company's dedicated Sales Coach voice (or null = follow
 *        C.A.R.E), the C.A.R.E voice it would follow, the effective voice
 *        actually used, and the curated picker list.
 * POST → set the dedicated voice (or null to clear → follow C.A.R.E).
 *
 * Manager-gated (company admin OR sales_coach admin). §A21 — reuses
 * care_tenant_config + CURATED_VOICES. §3.4 — reports the EFFECTIVE voice
 * truthfully (custom › C.A.R.E › default).
 */
async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isManager = isSalesCoachManager({
    role,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  return {
    ok: true as const,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function GET() {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "The cue voice is managed by admins." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("care_tenant_config")
    .select("sales_coach_voice_id, voice_id")
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  const salesCoachVoiceId =
    (tenant?.sales_coach_voice_id as string | null) ?? null;
  const careVoiceId = (tenant?.voice_id as string | null) ?? null;
  const effectiveVoiceId =
    salesCoachVoiceId ?? careVoiceId ?? DEFAULT_VOICE_ID;

  return NextResponse.json({
    salesCoachVoiceId,
    careVoiceId,
    effectiveVoiceId,
    defaultVoiceId: DEFAULT_VOICE_ID,
    voices: CURATED_VOICES,
  });
}

const Body = z.object({
  // null clears the dedicated voice → follow the C.A.R.E voice.
  voiceId: z.string().max(64).nullable(),
});

export async function POST(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "Only an admin can set the cue voice." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("care_tenant_config")
    .upsert(
      { company_id: ctx.companyId, sales_coach_voice_id: body.voiceId },
      { onConflict: "company_id" }
    );
  if (error) {
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
