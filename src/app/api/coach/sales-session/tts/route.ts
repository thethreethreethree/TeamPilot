import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { synthesizeSpeechStream } from "@/lib/care/voice/elevenlabs";

/**
 * POST /api/coach/sales-session/tts (Live Sales Coach S1b)
 *
 * Voices a live cue privately to the AGENT. Reuses the same ElevenLabs
 * flash TTS as Jeff (synthesizeSpeechStream), but authed for the
 * logged-in agent — NOT /api/care/tts, which requires a customer
 * x-care-session token and so returned 401 to the dashboard
 * (root cause of "no cue audio", 2026-06-27).
 */

const Body = z.object({
  text: z.string().min(1).max(2000),
  // Optional preview override (Settings voice picker): synthesize a sample
  // in a specific voice before saving it. When absent, the tenant's
  // configured Sales Coach voice is resolved below.
  voiceId: z.string().max(64).optional(),
});

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "sales-coach-tts",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Voice precedence: an explicit preview override wins; else the
  // tenant's DEDICATED Sales Coach voice; else the C.A.R.E voice it
  // follows by default; else the deployment default (NULL → default in
  // synthesizeSpeechStream). Decoupled from Jeff once a dedicated voice
  // is set (migration 0075).
  let voiceId: string | null = body.voiceId ?? null;
  if (!voiceId) {
    const companyId = await getCurrentCompanyId();
    if (companyId) {
      const admin = createAdminClient();
      const { data: tenant } = await admin
        .from("care_tenant_config")
        .select("sales_coach_voice_id, voice_id")
        .eq("company_id", companyId)
        .maybeSingle();
      voiceId =
        (tenant?.sales_coach_voice_id as string | null) ??
        (tenant?.voice_id as string | null) ??
        null;
    }
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await synthesizeSpeechStream({ text: body.text, voiceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TTS synthesis failed." },
      { status: 502 }
    );
  }

  return new NextResponse(stream, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
