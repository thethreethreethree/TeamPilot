import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { probeElevenLabsVoice } from "@/lib/care/voice/elevenlabs";

/**
 * GET /api/coach/sales-session/voice-health — a manager-only, read-only probe of the ElevenLabs
 * voice provider. Live coaching audio AND recording transcription both auth against ElevenLabs STT,
 * so one provider problem breaks both at once; this endpoint pins the EXACT cause (key unset /
 * wrong-or-expired key / quota exhausted / missing Speech-to-Text scope / network) without an
 * operator having to read Vercel runtime logs. Read-only and character-free (lists the subscription
 * and mints a single-use token — never transcribes or synthesizes).
 *
 * Manager-gated: the probe reveals account-level quota, which reps should not see.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: me } = await sb
    .from("profiles")
    .select("role, sales_coach_role, company_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const manager = isSalesCoachManager({
    role: (me?.role as string | null) ?? null,
    sales_coach_role: (me?.sales_coach_role as string | null) ?? null,
    company_id: (me?.company_id as string | null) ?? null,
  });
  if (!manager) {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }

  const result = await probeElevenLabsVoice();
  // 200 with ok:false is intentional — the probe SUCCEEDED at diagnosing; the provider is what's down.
  return NextResponse.json(result);
}
