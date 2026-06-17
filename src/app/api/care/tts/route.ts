import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getCareConversationByToken } from "@/lib/data/care";
import { createAdminClient } from "@/lib/supabase/admin";
import { synthesizeSpeech } from "@/lib/care/voice/elevenlabs";

/**
 * POST /api/care/tts
 *
 * Customer-side TTS endpoint. Converts Jeff's text reply into
 * audio so the customer hears it. Auth via the existing
 * x-care-session header — same session the widget uses for
 * /messages. Constitutional sources (consulted per §0.1):
 *   - §A16 — TTS is downstream of the LLM pipeline. The text
 *     was already produced by Jeff via the normal /messages
 *     flow; this endpoint just converts it to audio. Coach
 *     grades the text regardless of whether the customer heard
 *     it as voice.
 *   - §A14 — multi-state contract: 200 with audio bytes on
 *     success, 4xx/5xx on failure. The widget surfaces the
 *     error state explicitly per §A14 render-branch discipline.
 *   - §A4 — voice picker per-tenant deferred; we resolve via
 *     tenant config voice_id column (NULL → deployment default).
 *
 * Rate-limited because TTS calls cost real money. The limit is
 * generous enough for normal conversation but blocks runaway
 * usage.
 */

const Body = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "care-tts",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  // Customer session auth — same shape as /messages.
  const token = req.headers.get("x-care-session");
  if (!token) {
    return NextResponse.json(
      { error: "Missing session token." },
      { status: 401 }
    );
  }
  const conversation = await getCareConversationByToken(token);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Resolve the tenant's voice preference. NULL → deployment
  // default (Antoni).
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("care_tenant_config")
    .select("voice_id")
    .eq("company_id", conversation.companyId)
    .maybeSingle();
  const voiceId = (tenant?.voice_id as string | null) ?? null;

  // Synthesize. Errors propagate as 502 with the provider's
  // message; the widget surfaces them per §A14.
  let audio: Buffer;
  try {
    audio = await synthesizeSpeech({ text: body.text, voiceId });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "TTS synthesis failed.",
      },
      { status: 502 }
    );
  }

  // Stream mp3 bytes back. Browser plays via Audio API in the
  // widget — see CareEmbeddedWidget voice mode handlers.
  return new NextResponse(new Uint8Array(audio), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.byteLength.toString(),
      "Cache-Control": "no-store",
    },
  });
}
