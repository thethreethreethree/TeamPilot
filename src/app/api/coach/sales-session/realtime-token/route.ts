import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { mintRealtimeSttToken } from "@/lib/care/voice/elevenlabs";

/**
 * POST /api/coach/sales-session/realtime-token (Live Sales Coach S1b)
 *
 * Mints a short-lived single-use Scribe v2 Realtime token so the browser
 * can open the STT websocket DIRECTLY to ElevenLabs without ever seeing
 * the API key (founder-chosen browser-direct data-flow, 2026-06-27).
 *
 * Auth-gated: only a signed-in user gets a token. The token itself is
 * single-use + ~15-min TTL, so it's low-value if intercepted.
 *
 * UNTESTED against the live ElevenLabs token API.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "sales-realtime-token",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const token = await mintRealtimeSttToken();
    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token mint failed." },
      { status: 502 }
    );
  }
}
