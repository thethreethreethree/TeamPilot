import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/care/extension/refresh — exchange a Supabase refresh token for a fresh session.
 *
 * The extension's access token expires (~1h). Rather than force the user to reconnect (audit A4), the
 * extension calls this when a tool returns 401: it proxies Supabase's refresh-token grant server-side, so
 * the extension never needs the Supabase host in its permissions and the anon key stays out of the
 * extension bundle. Returns the new { access_token, refresh_token } or 401 if the refresh token is invalid.
 *
 * No auth gate here (the refresh token IS the credential); rate-limited to blunt brute force.
 */

export const runtime = "nodejs";

const Schema = z.object({ refresh_token: z.string().min(1).max(4096) }).strict();

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "care-ext-refresh", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Schema);
  if (body instanceof NextResponse) return body;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Auth not configured." }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: body.refresh_token }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!res.ok || !data.access_token) {
      return NextResponse.json({ error: "Session could not be refreshed. Sign in again." }, { status: 401 });
    }
    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? body.refresh_token,
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the auth service." }, { status: 502 });
  }
}
