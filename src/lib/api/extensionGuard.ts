import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import type { ExtensionUser } from "@/lib/api/extensionAuth";

/**
 * Shared request guard for the C.A.R.E extension tool endpoints (summarize/dissect/coach/copilot/formulate/spawn).
 *
 * Every one of those routes ran the SAME security-critical sequence inline: a coarse per-IP pre-auth flood guard
 * (before the token round-trip), then the Bearer + entitlement gate, then a per-USER rate limit, then body
 * validation. Six copies drift — that's how the Co-Pilot empty-reply divergence crept in. Centralizing it here
 * means ONE correct gate ORDER (the property the route tests assert: an unentitled / rate-limited caller is
 * turned away BEFORE any paid LLM compute) and a single place to change limits.
 *
 * Returns the resolved user + validated body on success, or the NextResponse the route should return as-is.
 * The order is load-bearing — do not reorder without updating the gate-ordering tests.
 */
export async function guardExtensionRequest<T>(
  req: NextRequest,
  opts: { tool: string; perUserMax: number; schema: z.ZodType<T> }
): Promise<{ ok: true; user: ExtensionUser; body: T } | { ok: false; response: NextResponse }> {
  // 1. Coarse per-IP guard BEFORE auth — protects the token-validation round-trip from unauthenticated floods.
  const preAuth = rateLimit(req, { id: "care-ext", windowMs: 60_000, max: 60 });
  if (preAuth) return { ok: false, response: preAuth };

  // 2. Bearer token + pro/enterprise-or-trial entitlement (server-enforced; never trust the client).
  const gate = await requireEntitledExtensionUser(req);
  if (!gate.ok) return { ok: false, response: gate.response };

  // 3. Per-USER limit (so colleagues on one office IP don't share a bucket on a paid feature).
  const limited = rateLimit(req, {
    id: `care-ext-${opts.tool}:${gate.user.userId}`,
    windowMs: 60_000,
    max: opts.perUserMax,
  });
  if (limited) return { ok: false, response: limited };

  // 4. Validate the body against the route's strict schema.
  const body = await readBody(req, opts.schema);
  if (body instanceof NextResponse) return { ok: false, response: body };

  return { ok: true, user: gate.user, body };
}
