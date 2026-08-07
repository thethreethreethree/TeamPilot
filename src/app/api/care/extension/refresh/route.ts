import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { refreshExtensionSession } from "@/lib/api/extensionRefresh";

/**
 * POST /api/care/extension/refresh — exchange a Supabase refresh token for a fresh session.
 *
 * The extension's access token expires (~1h). Rather than force the user to reconnect (audit A4), the
 * extension calls this when a tool returns 401: it proxies Supabase's refresh-token grant server-side, so
 * the extension never needs the Supabase host in its permissions and the anon key stays out of the
 * extension bundle. Returns the new { access_token, refresh_token } or 401 if the refresh token is invalid.
 *
 * The generic Supabase-refresh logic lives in refreshExtensionSession (shared with the Sales Coach
 * extension's refresh route — one mechanism, not a fork). No auth gate here (the refresh token IS the
 * credential); rate-limited to blunt brute force.
 */

export const runtime = "nodejs";

const Schema = z.object({ refresh_token: z.string().min(1).max(4096) }).strict();

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "care-ext-refresh", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Schema);
  if (body instanceof NextResponse) return body;

  const result = await refreshExtensionSession(body.refresh_token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });
}
