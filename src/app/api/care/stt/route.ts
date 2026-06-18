import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { getCareConversationByToken } from "@/lib/data/care";
import { transcribeSpeech } from "@/lib/care/voice/elevenlabs";

/**
 * POST /api/care/stt
 *
 * Customer-side STT endpoint. Accepts an audio blob from the
 * widget (typically webm/opus from MediaRecorder) and returns
 * the transcript. Auth via x-care-session.
 *
 * The transcript is NOT persisted here — the widget takes the
 * returned string and POSTs it to the existing
 * /api/care/conversations/[id]/messages endpoint with
 * { body: transcript, medium: "voice" } so the §3.1 event chain
 * stays intact and Jeff's brain (system prompt + Coach + Co-Pilot)
 * runs unchanged per §A16.
 *
 * Rate-limited because STT costs real money.
 */
// Per TT.md A21 audit (2026-06-18) HIGH finding — until this fix:
//   - The 10MB byte cap allowed ~40min of opus audio per request.
//     ElevenLabs Scribe bills per minute transcribed; a single
//     attacker request could cost real money.
//   - The 30/min rate limit at full payload size was a sustained
//     cost-attack surface (30 × ~40min = 20 cumulative hours of
//     audio per minute).
// Tightened to a 2MB cap (~8min of opus, still generous for a
// conversational support widget where 30s is typical) and 8/min
// rate (8 voice queries per minute per IP is already heavy
// legitimate use).
const STT_MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "care-stt",
    windowMs: 60_000,
    max: 8,
  });
  if (limited) return limited;

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

  // Read audio blob from body. Browsers send arbitrary mime
  // types depending on codec support (audio/webm, audio/mp4,
  // audio/wav). Pass whatever they sent verbatim to the
  // provider — ElevenLabs Scribe handles common formats.
  const contentType = req.headers.get("content-type") ?? "audio/webm";
  let buffer: Buffer;
  try {
    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Empty audio payload." },
        { status: 400 }
      );
    }
    // Per TT.md A21 audit cost guardrail — cap at STT_MAX_BYTES
    // (2MB). A conversational voice query in a support widget is
    // typically 5-30s ≈ 100-400KB at opus 32kbps. 2MB is ~8min,
    // bounded against accident and abuse while remaining
    // generous for legitimate verbose customers.
    if (arrayBuffer.byteLength > STT_MAX_BYTES) {
      return NextResponse.json(
        {
          error:
            "Audio payload too large. Voice queries should be under ~2 minutes; please re-record a shorter message.",
        },
        { status: 413 }
      );
    }
    buffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json(
      { error: "Couldn't read audio payload." },
      { status: 400 }
    );
  }

  let transcript: string;
  try {
    transcript = await transcribeSpeech({
      audio: buffer,
      mimeType: contentType,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "STT transcription failed.",
      },
      { status: 502 }
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "Couldn't make out what was said. Try again." },
      { status: 422 }
    );
  }

  return NextResponse.json({ transcript });
}
