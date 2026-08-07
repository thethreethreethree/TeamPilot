import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { refreshExtensionSession } from "@/lib/api/extensionRefresh";

/**
 * POST /api/coach/extension/refresh — exchange a Supabase refresh token for a fresh session, for the Sales
 * Coach browser extension.
 *
 * Identical mechanism to the C.A.R.E refresh route — both call the shared refreshExtensionSession (one
 * implementation, not a fork). The generic Supabase-session refresh has no product coupling, so the two
 * extensions share it; each supplies its own rate-limit id. No auth gate (the refresh_token IS the
 * credential; the access token being refreshed is expired). Allowlisted in invariant-audit INVARIANT 8 with
 * this different-auth-model reason. Rate-limited to blunt brute force.
 */

export const runtime = "nodejs";

const Schema = z.object({ refresh_token: z.string().min(1).max(4096) }).strict();

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-ext-refresh", windowMs: 60_000, max: 20 });
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
