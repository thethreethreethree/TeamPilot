import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { isValidEnrollmentF0, MIN_VOICED_FRAMES } from "@/lib/coach/v5/voiceEnrollment";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * Voice enrollment — the mandatory voice-recognition gate (partner meeting 9/2, founder 2026-09-09).
 *
 * GET  → { enrolled, f0Hz } for the current rep — drives the enroll prompt + the session gate.
 * POST { f0Hz, voicedFrames } → store the rep's derived median fundamental frequency on their OWN profile.
 *   The client captures a short read, runs detectF0 (the SAME live detector), and derives the number via
 *   deriveEnrollmentF0 — so only a NUMBER is sent, never audio (off the biometric surface by construction).
 *   The server re-validates the number is in the human-voice band and that enough voiced frames backed it,
 *   then writes voice_f0_hz + voice_enrolled_at on the caller's profile (RLS "own profile - update"; these
 *   are self-settable feature columns, not authz — 0090 is unaffected, mirroring macro_mode).
 *
 * Migration-coupling (§A34): voice_f0_hz / voice_enrolled_at land in 0246. Until it applies, GET degrades to
 * "not enrolled" and POST reports "not available yet" rather than a bare 500 — a guarded fallback that fires
 * ONLY for the pending-migration case (isMissingColumnError names the column) and stays loud for anything else.
 */

const Body = z.object({
  f0Hz: z.number(),
  voicedFrames: z.number().int().nonnegative(),
});

export async function GET(req: NextRequest) {
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("profiles")
    .select("voice_f0_hz, voice_enrolled_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, "voice_enrolled_at")) {
      return NextResponse.json({ enrolled: false, f0Hz: null }); // migration pending — honest "not yet"
    }
    console.error("[voice-enrollment GET] read failed:", error.message); // CWE-209: detail logged, generic returned
    return NextResponse.json({ error: "Couldn't read enrollment status." }, { status: 500 });
  }
  return NextResponse.json({
    enrolled: Boolean(data?.voice_enrolled_at),
    f0Hz: (data?.voice_f0_hz as number | null) ?? null,
  });
}

export async function POST(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Re-validate the client-derived number server-side — never store an out-of-range F0 or a too-thin capture.
  if (!isValidEnrollmentF0(body.f0Hz) || body.voicedFrames < MIN_VOICED_FRAMES) {
    return NextResponse.json(
      { error: "That recording didn't capture a clear enough voice. Please try again in a quieter spot." },
      { status: 422 }
    );
  }

  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { error } = await sb
    .from("profiles")
    .update({ voice_f0_hz: body.f0Hz, voice_enrolled_at: new Date().toISOString() })
    .eq("id", auth.user.id);
  if (error) {
    if (isMissingColumnError(error, "voice_enrolled_at")) {
      return NextResponse.json(
        { error: "Voice enrollment isn't available yet — the update is still rolling out." },
        { status: 503 }
      );
    }
    console.error("[voice-enrollment POST] write failed:", error.message);
    return NextResponse.json({ error: "Couldn't save your voice enrollment." }, { status: 500 });
  }
  return NextResponse.json({ enrolled: true, f0Hz: body.f0Hz });
}
