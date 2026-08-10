import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic (2026-08-09 voice outage). Reveals ONLY the SHAPE of ELEVENLABS_API_KEY as the
 * LIVE deployment actually sees it: is it present, and does it start with "sk_" (a real ElevenLabs key)
 * vs not (the 64-char key ID that's been the bug). It returns NO key value, NO length, NO account data —
 * nothing an attacker could use — so it's safe to leave unauthenticated for the duration of the incident.
 * Purpose: let an operator confirm which value prod loaded WITHOUT a manager login (the founder was on
 * mobile and couldn't easily paste the authed voice-health output). REMOVE once voice is restored.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  return NextResponse.json({
    present: key.length > 0,
    startsWithSk: key.startsWith("sk_"), // true = real key loaded; false = still the ID (the bug)
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
