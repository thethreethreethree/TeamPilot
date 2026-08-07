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
 * VERIFIED live 2026-08-06 (HTTP 200 + token). A prod "Token mint failed" is env/deploy/account, not code —
 * a Vercel env-var change (adding ELEVENLABS_API_KEY) needs a REDEPLOY to take effect. See the server log.
 */
// Awaits an in-path external ElevenLabs call (mintRealtimeSttToken). A modest ceiling
// over Vercel's short default so a provider latency spike returns the graceful 502
// below rather than an opaque platform timeout. Fast call, so 60 is ample.
export const maxDuration = 60;

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
    // Log the real cause server-side (missing ELEVENLABS_API_KEY vs a provider 401/402/403 — see
    // elevenlabs.ts getApiKey + mintRealtimeSttToken), but never show the rep developer jargon like
    // "Token mint failed". Give them a plain, actionable message: the Upload-recording fallback is rendered
    // right below, so point them at it.
    console.error("[realtime-token] mint failed:", err);
    return NextResponse.json(
      {
        error:
          "Live coaching's audio couldn't start right now. Upload the call recording below to still get your transcript — or try again in a moment.",
      },
      { status: 502 }
    );
  }
}
